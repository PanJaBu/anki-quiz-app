'use client';

import React, { useEffect, useState } from 'react';
import { load as parseYaml } from 'js-yaml';
import Quiz from './components/Quiz';

type DataFileConfig = {
  file: string;
  weight: number;
  label?: string;
};

type ExamConfig = {
  id: string;
  tabLabel: string;
  qualificationLabel?: string;
  qualificationCode: string;
  qualificationName?: string;
  professionLabel?: string;
  profession: string;
  sourceLink?: string;
  sourceLinkLabel?: string;
  randomModeInfo?: string;
  hideRandomCount?: boolean;
  files: DataFileConfig[];
};

type AppConfig = {
  exams: ExamConfig[];
};

const getImagePath = (file: string, img: string | undefined) => {
  if (!img) return undefined;
  const normalizedImg = img.trim();
  if (!normalizedImg) return undefined;
  
  // Sprawdź czy img to rzeczywista ścieżka do obrazka
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.webo'];
  const hasImageExtension = imageExtensions.some(ext => normalizedImg.toLowerCase().endsWith(ext));
  
  // Jeśli nie ma rozszerzenia obrazka, to prawdopodobnie to tekst opisowy
  if (!hasImageExtension) {
    return { isText: true, text: normalizedImg };
  }
  
  return { isText: false, path: `/images/${file.replace('data_', '').replace('.json', '')}/${normalizedImg}` };
};

function shuffleOptions(options: any[], correctIndex: number) {
  const arr = options.map((opt, idx) => ({ ...opt, origIndex: idx }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const newCorrectIndex = arr.findIndex(opt => opt.origIndex === correctIndex);
  return { shuffled: arr, newCorrectIndex };
}

export default function Home() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [mode, setMode] = useState<'all' | 'random'>('all');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [randomCount, setRandomCount] = useState(40);
  const [learningMode, setLearningMode] = useState(true);
  const [examConfigs, setExamConfigs] = useState<ExamConfig[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/config/exams.yaml');
        if (!res.ok) {
          throw new Error(`Nie udało się pobrać konfiguracji (${res.status})`);
        }

        const yamlText = await res.text();
        const parsed = parseYaml(yamlText) as AppConfig | undefined;
        if (!parsed?.exams || !Array.isArray(parsed.exams) || parsed.exams.length === 0) {
          throw new Error('Konfiguracja YAML nie zawiera poprawnej listy egzaminów.');
        }

        setExamConfigs(parsed.exams);
        setSelectedExam(parsed.exams[0].id);
      } catch (error) {
        console.error('Błąd ładowania konfiguracji egzaminów:', error);
      }
    };

    loadConfig();
  }, []);

  const selectedExamConfig = examConfigs.find((exam) => exam.id === selectedExam);
  const currentDataFiles = selectedExamConfig?.files ?? [];
  const qualificationLabel = selectedExamConfig?.qualificationLabel ?? 'Kwalifikacja';
  const professionLabel = selectedExamConfig?.professionLabel ?? 'Zawód';

  const handleExamChange = (exam: string) => {
    setSelectedExam(exam);
    setSelectedFile(''); // Reset wybranego pliku przy zmianie egzaminu
  };

  const mapQuestion = (q: any, file: string) => {
    const optionsArr = [
      { text: q['a.'], img: getImagePath(file, q.img_a) },
      { text: q['b.'], img: getImagePath(file, q.img_b) },
      { text: q['c.'], img: getImagePath(file, q.img_c) },
      { text: q['d.'], img: getImagePath(file, q.img_d) },
    ];
    const correctIndex = q.correct.split(' ').findIndex((v: string) => v === '1');
    const { shuffled, newCorrectIndex } = shuffleOptions(optionsArr, correctIndex);
    return {
      id: q.id,
      question: q.question,
      options: shuffled,
      answerIndex: newCorrectIndex,
      explanation: q.explanation,
      image: getImagePath(file, q.img),
    };
  };

  const handleStart = async () => {
    setLoading(true);
    let allQuestions: any[] = [];
    
    if (mode === 'all' && selectedFile) {
      const res = await fetch(`/data/${selectedFile}`);
      const data = await res.json();
      const questionsArr = Array.isArray(data) ? data : Array.isArray(data.questions) ? data.questions : [];
      allQuestions = questionsArr.map((q: any) => mapQuestion(q, selectedFile));
    } else if (mode === 'random') {
      const all = await Promise.all(
        currentDataFiles.map(async (fileObj) => {
          const res = await fetch(`/data/${fileObj.file}`);
          const data = await res.json();
          const questionsArr = Array.isArray(data) ? data : Array.isArray(data.questions) ? data.questions : [];
          const questions = questionsArr.map((q: any) => mapQuestion(q, fileObj.file));
          
          // Tryb specjalny: losuj tyle pytań z pliku ile wynosi jego waga
          if (selectedExamConfig?.hideRandomCount) {
            const questionsToTake = Math.min(fileObj.weight, questions.length);
            return questions.sort(() => Math.random() - 0.5).slice(0, questionsToTake);
          }

          // Jeśli to 40 pytań, uwzględnij wagi
          if (randomCount === 40) {
            const questionsToTake = Math.min(fileObj.weight, questions.length);
            return questions.sort(() => Math.random() - 0.5).slice(0, questionsToTake);
          } else {
            // Dla mniejszej liczby pytań, weź wszystkie dostępne
            return questions;
          }
        })
      );
      const allFlattened = all.flat().sort(() => Math.random() - 0.5);
      allQuestions = selectedExamConfig?.hideRandomCount
        ? allFlattened
        : allFlattened.slice(0, randomCount);
    }
    setQuestions(allQuestions);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        {questions.length === 0 ? (
          <div className="max-w-xl mx-auto bg-white rounded-lg shadow p-8">
            {examConfigs.length === 0 && (
              <div className="mb-4 text-sm text-red-600">
                Nie udało się załadować konfiguracji egzaminów z pliku YAML.
              </div>
            )}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-4 text-center">Wybierz egzamin</h2>
              <div className="flex justify-center space-x-4">
                {examConfigs.map((exam) => (
                  <label key={exam.id} className="flex items-center">
                    <input
                      type="radio"
                      name="exam"
                      value={exam.id}
                      checked={selectedExam === exam.id}
                      onChange={() => handleExamChange(exam.id)}
                      className="mr-2"
                    />
                    {exam.tabLabel}
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-6 text-center">
              <div className="text-4xl font-extrabold mb-2">{qualificationLabel}: <span className="font-bold">
                {selectedExamConfig?.qualificationCode ?? '-'}
              </span></div>
              {selectedExamConfig?.qualificationName ? (
                <div className="text-3xl font-bold mb-2">
                  Nazwa kwalifikacji:{' '}
                  <span className="font-semibold">
                    {selectedExamConfig.qualificationName}
                  </span>
                </div>
              ) : selectedExamConfig?.sourceLink && selectedExamConfig?.sourceLinkLabel ? (
                <div className="text-3xl font-bold mb-2">
                  <span className="font-semibold">
                    <a
                      href={selectedExamConfig.sourceLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-700 hover:text-blue-900"
                    >
                      {selectedExamConfig.sourceLinkLabel}
                    </a>
                  </span>
                </div>
              ) : (
                selectedExamConfig && (
                  <div className="text-3xl font-bold mb-2">
                    <span className="font-semibold">{selectedExamConfig.tabLabel}</span>
                  </div>
                )
              )}
              <div className="text-3xl font-bold">{professionLabel}: <span className="font-semibold">
                {selectedExamConfig?.profession ?? '-'}
              </span></div>
            </div>
            <h1 className="text-2xl font-bold mb-6 text-center">Wybierz tryb quizu</h1>
            <div className="mb-4">
              <label className="mr-4">
                <input
                  type="radio"
                  checked={mode === 'all'}
                  onChange={() => setMode('all')}
                  className="mr-2"
                />
                Wszystkie pytania z wybranego pliku
              </label>
              <label>
                <input
                  type="radio"
                  checked={mode === 'random'}
                  onChange={() => setMode('random')}
                  className="mr-2"
                />
                Losowy quiz
              </label>
            </div>
            {mode === 'all' && (
              <div className="mb-4">
                <select
                  className="border rounded px-3 py-2 w-full"
                  value={selectedFile}
                  onChange={e => setSelectedFile(e.target.value)}
                >
                  <option value="">Wybierz plik</option>
                  {currentDataFiles.map(f => (
                    <option key={f.file} value={f.file}>
                      {(f.label ?? f.file.replace('data_', '').replace('.json', ''))} (waga: {f.weight})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {mode === 'random' && !selectedExamConfig?.hideRandomCount && (
              <div className="mb-4">
                <label className="mr-2">Liczba pytań:</label>
                <select
                  className="border rounded px-3 py-2"
                  value={randomCount}
                  onChange={e => setRandomCount(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={40}>40</option>
                </select>
              </div>
            )}
            {mode === 'random' && selectedExamConfig?.hideRandomCount && selectedExamConfig?.randomModeInfo && (
              <div className="mb-4 text-sm text-gray-600">
                {selectedExamConfig.randomModeInfo}
              </div>
            )}
            <div className="mb-4 flex items-center">
              <input
                type="checkbox"
                id="learningMode"
                checked={learningMode}
                onChange={e => setLearningMode(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="learningMode" className="text-lg select-none">Tryb nauki</label>
            </div>
            <button
              className="w-full py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              onClick={handleStart}
              disabled={examConfigs.length === 0 || (mode === 'all' && !selectedFile) || loading}
            >
              {loading ? 'Ładowanie...' : 'Rozpocznij quiz'}
            </button>
          </div>
        ) : (
          <Quiz questions={questions} learningMode={learningMode} dataFileName={questions[0]?.dataFileName || selectedFile} />
        )}
      </div>
    </main>
  );
} 
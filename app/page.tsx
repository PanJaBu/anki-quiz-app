'use client';

import React, { useState } from 'react';
import Quiz from './components/Quiz';

// Wagi określają ile pytań ma być pobieranych z każdego pliku podczas losowania 40 pytań
// weight: 0 = nie pobieraj pytań z tego pliku
// weight: 1 = pobierz 1 pytanie z tego pliku
// weight: 2 = pobierz 2 pytania z tego pliku, itd.
const DATA_FILES_ELM7 = [
  { file: 'data_ELM071.json', weight: 1 },
  { file: 'data_ELM072.json', weight: 9 },
  { file: 'data_ELM073.json', weight: 9 },
  { file: 'data_ELM074.json', weight: 9 },
  { file: 'data_ELM075.json', weight: 8 },
  { file: 'data_ELM076.json', weight: 1 },
  { file: 'data_ELM077.json', weight: 1 },
  { file: 'data_ELM078.json', weight: 1 },
  { file: 'data_ELMSiemensPLC.json', weight:  2},
  { file: 'data_ELMArduino.json', weight: 2 },
  { file: 'data_ELM077E.json', weight: 2 },
  { file: 'data_MechZestPytTestowych.json', weight: 4 },
];

const DATA_FILES_ELM8 = [
  { file: 'data_ELM081.json', weight: 1 },
  { file: 'data_ELM082.json', weight: 9 },
  { file: 'data_ELM083.json', weight: 9 },
  { file: 'data_ELM084.json', weight: 9 },
  { file: 'data_ELM085.json', weight: 9 },
  { file: 'data_ELM086.json', weight: 1 },
  { file: 'data_ELM087.json', weight: 1 },
  { file: 'data_ELM088.json', weight: 1 },
  { file: 'data_ELM089.json', weight: 10 },
];

 const DATA_FILES_PROGRAM_NAUCZANIA_ELM7_ELM8 = [
  { file: '2_Podstawy_robotyki.json', weight: 20 },
  { file: '3_Technologie_i_konstrukcje_mechaniczne_w_robotyce.json', weight: 20 },
  { file: '4_Zapis_konstrukcji.json', weight: 20 },
  { file: '5_Elektrotechnika_i_elektronika_w_robotyce.json', weight: 20 },
  { file: '6_Podstawy_programowania_robotow.json', weight: 20 },
  { file: '7_Komputerowe_wspomaganie_w_robotyce.json', weight: 20 },
  { file: '8_Pracownia_elektryczna_i_elektroniczna.json', weight: 20 },
  { file: '9_Pracownia_systemow_robotyki.json', weight: 20 },
  { file: '10_Pracownia_programowania_i_eksploatacji_robotow_przemyslowych.json', weight: 20 },
  { file: '11_Projektowanie_ukladow_sterowania_robotow.json', weight: 20 },
  { file: '12_Pracownia_pneumatyki_i_hydrauliki.json', weight: 20 },
  { file: '13_Diagnozowanie_i_konserwacja_systemow_robotyki.json', weight: 20 },
 ];

const DATA_FILES_MECH = [
  { file: 'data_Mech1.json', weight: 8 },
  { file: 'data_Mech2.json', weight: 8 },
  { file: 'data_Mech3.json', weight: 8 },
  { file: 'data_Mech4.json', weight: 8 },
  { file: 'data_Mech5.json', weight: 8 },
  { file: 'data_Mech6.json', weight: 8 },
];

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
  const [selectedExam, setSelectedExam] = useState<'ELM07' | 'ELM08' | 'MECH' | 'PROGRAM_NAUCZANIA'>('ELM07');
  const currentDataFiles =
    selectedExam === 'ELM07' ? DATA_FILES_ELM7 :
    selectedExam === 'ELM08' ? DATA_FILES_ELM8 :
    selectedExam === 'MECH' ? DATA_FILES_MECH :
    DATA_FILES_PROGRAM_NAUCZANIA_ELM7_ELM8;

  const handleExamChange = (exam: 'ELM07' | 'ELM08' | 'MECH' | 'PROGRAM_NAUCZANIA') => {
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
          
          // Program nauczania: losuj tyle pytań z pliku ile wynosi jego waga
          if (selectedExam === 'PROGRAM_NAUCZANIA') {
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
      allQuestions = selectedExam === 'PROGRAM_NAUCZANIA'
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
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-4 text-center">Wybierz egzamin</h2>
              <div className="flex justify-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="exam"
                    value="ELM07"
                    checked={selectedExam === 'ELM07'}
                    onChange={() => handleExamChange('ELM07')}
                    className="mr-2"
                  />
                  ELM.07
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="exam"
                    value="ELM08"
                    checked={selectedExam === 'ELM08'}
                    onChange={() => handleExamChange('ELM08')}
                    className="mr-2"
                  />
                  ELM.08
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="exam"
                    value="MECH"
                    checked={selectedExam === 'MECH'}
                    onChange={() => handleExamChange('MECH')}
                    className="mr-2"
                  />
                  MECH
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="exam"
                    value="PROGRAM_NAUCZANIA"
                    checked={selectedExam === 'PROGRAM_NAUCZANIA'}
                    onChange={() => handleExamChange('PROGRAM_NAUCZANIA')}
                    className="mr-2"
                  />
                  Program nauczania ELM7 i ELM8
                </label>
              </div>
            </div>
            <div className="mb-6 text-center">
              <div className="text-4xl font-extrabold mb-2">Kwalifikacja: <span className="font-bold">
                {selectedExam === 'ELM07' ? 'ELM.07' : 
                 selectedExam === 'ELM08' ? 'ELM.08' : 
                 selectedExam === 'MECH' ? 'MECHATRONIK' :
                 'ELM7 I ELM8'}
              </span></div>
              {selectedExam === 'ELM07' || selectedExam === 'ELM08' ? (
                <div className="text-3xl font-bold mb-2">
                  Nazwa kwalifikacji:{' '}
                  <span className="font-semibold">
                    {selectedExam === 'ELM07'
                      ? 'Montaż, uruchamianie i obsługa robotyki'
                      : 'Eksploatacja i programowanie systemów robotyki'}
                  </span>
                </div>
              ) : selectedExam === 'MECH' ? (
                <div className="text-3xl font-bold mb-2">
                  <span className="font-semibold">Zebrane pytania do mechatronik z publikacji</span>
                </div>
              ) : (
                <div className="text-3xl font-bold mb-2">
                  <span className="font-semibold">
                    <a
                      href="https://ore.edu.pl/wp-content/plugins/download-attachments/includes/download.php?id=72318"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-700 hover:text-blue-900"
                    >
                      Pytania oparte o program nauczania ELM7 i ELM8
                    </a>
                  </span>
                </div>
              )}
              <div className="text-3xl font-bold">Zawód: <span className="font-semibold">
                {selectedExam === 'MECH'
                  ? 'Technik mechatronik'
                  : selectedExam === 'PROGRAM_NAUCZANIA'
                  ? 'Technik robotyk'
                  : 'Technik robotyk'}
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
                      {f.file.replace('data_', '').replace('.json', '')} (waga: {f.weight})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {mode === 'random' && selectedExam !== 'PROGRAM_NAUCZANIA' && (
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
            {mode === 'random' && selectedExam === 'PROGRAM_NAUCZANIA' && (
              <div className="mb-4 text-sm text-gray-600">
                W trybie losowym dla Programu nauczania pobierana jest liczba pytań zgodna z wagą każdego pliku.
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
              disabled={mode === 'all' && !selectedFile || loading}
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
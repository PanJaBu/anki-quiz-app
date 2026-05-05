import React, { useState, useEffect } from 'react';

interface QuizProps {
  questions: any[];
  learningMode: boolean;
  dataFileName: string;
}

const Quiz: React.FC<QuizProps> = ({ questions, learningMode, dataFileName }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [timeLeft, setTimeLeft] = useState(questions.length * 90); // Łączny czas na wszystkie pytania
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [isTestFinished, setIsTestFinished] = useState(false);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>(Array(questions.length).fill(null));
  const [isImageEnlarged, setIsImageEnlarged] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];

  useEffect(() => {
    if (isTestFinished) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          setIsTestFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTestFinished]);

  const handleOptionClick = (index: number) => {
    setSelectedOption(index);
    setShowAnswer(false);
    const newUserAnswers = [...userAnswers];
    newUserAnswers[currentQuestionIndex] = index;
    setUserAnswers(newUserAnswers);
    if (index === currentQuestion.answerIndex) {
      setCorrectAnswers((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOption(null);
      setShowAnswer(false);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setSelectedOption(null);
      setShowAnswer(false);
    }
  };

  const handleFinishTest = () => {
    setIsTestFinished(true);
  };

  const handleRestartTest = () => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setShowAnswer(false);
    setTimeLeft(questions.length * 90);
    setCorrectAnswers(0);
    setIsTestFinished(false);
    setUserAnswers(Array(questions.length).fill(null));
    window.location.href = '/'; // Przekieruj do strony głównej
  };

  const isPassed = correctAnswers / questions.length > 0.5;

  if (isImageEnlarged && currentQuestion.image && !currentQuestion.image.isText) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80" onClick={() => setIsImageEnlarged(false)}>
        <img
          src={currentQuestion.image.path}
          alt="Obraz do pytania"
          className="max-h-full max-w-full object-contain cursor-pointer"
        />
      </div>
    );
  }

  if (isTestFinished) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
        <h2 className="text-xl font-bold mb-4">Test zakończony</h2>
        <p className="font-bold">
          {Math.round((correctAnswers / questions.length) * 100)}% - Poprawne odpowiedzi: {correctAnswers} z {questions.length}
        </p>
        <p className="mt-2">
          {isPassed ? (
            <span className="text-green-600">Brawo zdałeś!</span>
          ) : (
            <span className="text-red-600">Niestety nie udało się tym razem. Musisz się jeszcze poczuć.</span>
          )}
        </p>
        <button
          onClick={handleRestartTest}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Rozpocznij ponownie test
        </button>
        <div className="mt-4">
          {questions.map((question, index) => (
            <div key={index} className={`mb-4 ${userAnswers[index] !== question.answerIndex ? 'bg-yellow-100' : ''}`}>
              {question.image && (
                <div className="mb-2 flex justify-center">
                  {question.image.isText ? (
                    <div className="bg-gray-100 p-4 rounded border text-center max-w-md">
                      <p className="text-sm text-gray-700">{question.image.text}</p>
                    </div>
                  ) : (
                    <img
                      src={question.image.path}
                      alt="Obraz do pytania"
                      className="max-h-48 object-contain"
                    />
                  )}
                </div>
              )}
              <p className="font-bold">Pytanie {index + 1}: {question.question}</p>
              <div className="space-y-2">
                {question.options.map((option: any, optIndex: number) => (
                  <div
                    key={optIndex}
                    className={`p-2 rounded ${
                      optIndex === question.answerIndex
                        ? 'bg-green-200'
                        : userAnswers[index] === optIndex
                        ? 'bg-red-200'
                        : 'bg-gray-100'
                    }`}
                  >
                    {option.text}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={handleRestartTest}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Rozpocznij ponownie test
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Pytanie {currentQuestionIndex + 1} z {questions.length}</h2>
        <p className="text-lg">Czas pozostały: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</p>
      </div>
      {currentQuestion.image && (
        <div className="mb-4 flex justify-center">
          {currentQuestion.image.isText ? (
            <div className="bg-gray-100 p-4 rounded border text-center max-w-md">
              <p className="text-sm text-gray-700">{currentQuestion.image.text}</p>
            </div>
          ) : (
            <img
              src={currentQuestion.image.path}
              alt="Obraz do pytania"
              className="max-h-64 object-contain cursor-pointer"
              onClick={() => setIsImageEnlarged(true)}
            />
          )}
        </div>
      )}
      <p className="mb-4">{currentQuestion.question}</p>
      <div className="space-y-2">
        {currentQuestion.options.map((option: any, index: number) => (
          <button
            key={index}
            onClick={() => handleOptionClick(index)}
            className={`w-full text-left p-2 rounded ${
              selectedOption === index ? 'bg-blue-200' : 'bg-gray-100'
            }`}
          >
            {option.text}
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
        >
          Poprzednie
        </button>
        <button
          onClick={() => setShowAnswer(true)}
          className={`px-4 py-2 rounded transition ${
            !learningMode || selectedOption === null || showAnswer
              ? 'bg-gray-300 text-gray-400 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
          disabled={selectedOption === null || showAnswer || !learningMode}
        >
          Pokaż odpowiedź
        </button>
        {currentQuestionIndex === questions.length - 1 ? (
          <button
            onClick={handleFinishTest}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Zakończ test
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Następne
          </button>
        )}
      </div>
      {showAnswer && (
        <div className="mt-4 p-4 bg-yellow-100 rounded">
          <p className="font-bold">Odpowiedź: {currentQuestion.options[currentQuestion.answerIndex].text}</p>
          <p className="mt-2">{currentQuestion.explanation}</p>
        </div>
      )}
    </div>
  );
};

export default Quiz; 
import React, { useState } from 'react';
import questions from './data/questions.json';

// --- Helper Functions & Constants ---
const API_KEY = ""; // Use "" for API key
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;

// --- Local Storage for Question Stats ---
const STATS_STORAGE_KEY = 'questionStats';

function loadQuestionStats() {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function persistQuestionStats(stats) {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (_) {
    // ignore write failures
  }
}

function mergeStatsIntoQuestions(baseQuestions) {
  const stats = loadQuestionStats();
  return baseQuestions.map((q) => {
    const stat = stats[q.id] || { attemptsCount: q.attemptsCount ?? 0, correctCount: q.correctCount ?? 0 };
    return { ...q, attemptsCount: stat.attemptsCount ?? 0, correctCount: stat.correctCount ?? 0 };
  });
}

// --- SVG Icons ---
const BookOpenIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);
const CheckCircleIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> );
const XCircleIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> );
const SparklesIcon = ({className}) => ( <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5 mr-2"} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm6 0a1 1 0 011 1v1h1a1 1 0 010 2h-1v1a1 1 0 01-2 0V6h-1a1 1 0 010-2h1V3a1 1 0 011-1zM9 10a1 1 0 011 1v1h1a1 1 0 010 2h-1v1a1 1 0 01-2 0v-1H6a1 1 0 010-2h1v-1a1 1 0 011-1zm-4 8a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0v-1H3a1 1 0 010-2h1v-1a1 1 0 011-1zm6 0a1 1 0 011 1v1h1a1 1 0 010 2h-1v1a1 1 0 01-2 0v-1h-1a1 1 0 010-2h1v-1a1 1 0 011-1z" clipRule="evenodd" /></svg> );
const LightBulbIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>);

// (stats는 startTest 시점에 병합)

// --- Main App Component ---
export default function App() {
  const [appState, setAppState] = useState('input'); // 'input', 'test', 'results'
  const [testQuestions, setTestQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [results, setResults] = useState([]);
  const [llmExplanations, setLlmExplanations] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // New state for Gemini features
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [similarQuestion, setSimilarQuestion] = useState(null); // { question, options, answer, explanation, originalConcept }
  const [isSimilarQuestionLoading, setIsSimilarQuestionLoading] = useState(null); // Will hold the id of the question being generated
  const [similarQuestionModalOpen, setSimilarQuestionModalOpen] = useState(false);


  const startTest = () => {
    const withStats = mergeStatsIntoQuestions(questions);
    const shuffled = [...withStats].sort(() => 0.5 - Math.random());
    setTestQuestions(shuffled);
    setUserAnswers(Array(shuffled.length).fill(''));
    setCurrentQuestionIndex(0);
    setAppState('test');
    setError(null);
  };

  const handleNextQuestion = () => {
    if (currentAnswer === '') { return; }
    const updatedAnswers = [...userAnswers];
    updatedAnswers[currentQuestionIndex] = currentAnswer;
    setUserAnswers(updatedAnswers);
    setCurrentAnswer('');

    if (currentQuestionIndex < testQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      submitTest(updatedAnswers);
    }
  };

  const submitTest = (finalAnswers) => {
    const calculatedResults = testQuestions.map((q, index) => ({
      ...q,
      userAnswer: finalAnswers[index],
      isCorrect: q.answer.trim().toLowerCase() === finalAnswers[index].trim().toLowerCase(),
    }));

    // Persist per-question attempts/correct stats
    const currentStats = loadQuestionStats();
    const updatedStats = { ...currentStats };
    calculatedResults.forEach((r) => {
      const prev = updatedStats[r.id] || { attemptsCount: 0, correctCount: 0 };
      updatedStats[r.id] = {
        attemptsCount: prev.attemptsCount + 1,
        correctCount: prev.correctCount + (r.isCorrect ? 1 : 0),
      };
    });
    persistQuestionStats(updatedStats);

    // Fire-and-forget remote sync to Vercel serverless API
    try {
      const updates = calculatedResults.map(r => ({ id: r.id, attemptsDelta: 1, correctDelta: r.isCorrect ? 1 : 0 }));
      fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      }).catch(() => {});
    } catch (_) {
      // ignore network errors
    }

    setResults(calculatedResults);
    setAppState('results');
  };

  const fetchLLMExplanations = async () => {
    setIsLoading(true);
    setError(null);
    setLlmExplanations({});

    const incorrectConcepts = results.filter(r => !r.isCorrect).map(r => r.concept);
    const uniqueConcepts = [...new Set(incorrectConcepts)];
    if (uniqueConcepts.length === 0) { setIsLoading(false); return; }

    try {
      const promises = uniqueConcepts.map(concept => {
        const userQuery = `'${concept}' 개념에 대해 수능 사회문화 과목을 공부하는 학생이 쉽게 이해할 수 있도록 자세히 설명해줘. 관련된 심화 내용이나 기출문제 풀이 팁도 포함해줘.`;
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            tools: [{ "google_search": {} }],
            systemInstruction: { parts: [{ text: "You are a friendly and knowledgeable tutor AI. Your goal is to explain concepts clearly and concisely to a student who got a question wrong." }] },
        };
        return fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(res => res.json())
            .then(result => ({ concept, explanation: result.candidates?.[0]?.content?.parts?.[0]?.text || "설명을 생성하지 못했습니다." }));
      });
      const explanations = await Promise.all(promises);
      const explanationMap = explanations.reduce((acc, curr) => ({ ...acc, [curr.concept]: curr.explanation }), {});
      setLlmExplanations(explanationMap);
    } catch (err) { setError("AI 설명 생성 중 오류가 발생했습니다."); } finally { setIsLoading(false); }
  };

  const fetchAIAnalysis = async () => {
      setIsAnalysisLoading(true);
      setAiAnalysis("");
      setError(null);
      const correctConcepts = results.filter(r => r.isCorrect).map(r => r.concept);
      const incorrectConcepts = results.filter(r => !r.isCorrect).map(r => r.concept);
      
      const userQuery = `저는 수능 사회문화 과목을 공부하는 학생입니다. 방금 10문제 퀴즈를 풀었고 결과는 다음과 같습니다:\n\n**정답 개념:**\n${[...new Set(correctConcepts)].join(', ') || '없음'}\n\n**오답 개념:**\n${[...new Set(incorrectConcepts)].join(', ')}\n\n이 결과를 바탕으로 제 학습 성과에 대한 종합적인 분석을 해주세요. 강점과 약점을 진단하고, 취약한 부분을 보완하기 위한 구체적이고 실천 가능한 학습 팁 2-3가지를 제안해주세요. 격려하는 말투로 친절하게 작성해주세요.`;

      try {
          const response = await fetch(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: userQuery }] }] })
          });
          const result = await response.json();
          setAiAnalysis(result.candidates?.[0]?.content?.parts?.[0]?.text || "분석 결과를 생성하지 못했습니다.");
      } catch (err) {
          setError("AI 분석 생성 중 오류가 발생했습니다.");
      } finally {
          setIsAnalysisLoading(false);
      }
  };

  const fetchSimilarQuestion = async (originalQuestion) => {
      setIsSimilarQuestionLoading(originalQuestion.id);
      setSimilarQuestion(null);
      setError(null);
      
      const userQuery = `You are a test question creator for South Korean college entrance exams (CSAT). Based on the following social studies concept and example question, create a new, similar multiple-choice question. The new question should test the same core concept but use a different scenario or wording. Provide 5 options, with one correct answer. Ensure the options are plausible distractors for a high school student.\n\n**Core Concept:** ${originalQuestion.concept}\n\n**Original Question:**\n${originalQuestion.question}\n\n**Original Options:**\n${originalQuestion.options.join('\n')}\n\n**Original Answer:** ${originalQuestion.answer}\n\nGenerate the new question in the specified JSON format.`;
      const schema = {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          answer: { type: "STRING" },
          explanation: { type: "STRING", description: "A brief explanation of why the correct answer is correct." }
        },
        required: ["question", "options", "answer", "explanation"]
      };

      try {
          const response = await fetch(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  contents: [{ parts: [{ text: userQuery }] }],
                  generationConfig: { responseMimeType: "application/json", responseSchema: schema }
              })
          });
          const result = await response.json();
          const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
          const parsedJson = JSON.parse(jsonText);
          
          if(parsedJson.options.length !== 5) throw new Error("Generated question does not have 5 options.");

          setSimilarQuestion({ ...parsedJson, originalConcept: originalQuestion.concept });
          setSimilarQuestionModalOpen(true);
      } catch (err) {
          console.error(err);
          setError("AI 유사 문제 생성 중 오류가 발생했습니다. 다른 문제로 시도해보세요.");
      } finally {
          setIsSimilarQuestionLoading(null);
      }
  };
  
  const resetApp = () => {
    setAppState('input');
    setTestQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setCurrentAnswer('');
    setResults([]);
    setLlmExplanations({});
    setError(null);
    setIsLoading(false);
    setAiAnalysis("");
    setIsAnalysisLoading(false);
    setSimilarQuestion(null);
    setSimilarQuestionModalOpen(false);
    setIsSimilarQuestionLoading(null);
  };
  
  // --- Render Components ---
  const SimilarQuestionModal = () => {
      if (!similarQuestionModalOpen || !similarQuestion) return null;

      const [userChoice, setUserChoice] = useState('');
      const [submitted, setSubmitted] = useState(false);
      const isCorrect = userChoice === similarQuestion.answer;

      const handleSubmit = () => {
          if (userChoice) setSubmitted(true);
      };

      return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl transform transition-all scale-100">
            <h3 className="text-xl font-bold text-indigo-800 mb-2">✨ AI 생성 유사 문제</h3>
            <p className="text-gray-600 mb-4">개념: {similarQuestion.originalConcept}</p>
            <p className="text-lg font-medium text-gray-800 my-4 whitespace-pre-wrap">{similarQuestion.question}</p>
            <div className="space-y-3">
              {similarQuestion.options.map((option, index) => {
                  let buttonClass = 'bg-white hover:bg-indigo-50 border-gray-300';
                  if (submitted) {
                      if (option === similarQuestion.answer) {
                          buttonClass = 'bg-green-100 border-green-500 text-green-800 font-semibold';
                      } else if (option === userChoice) {
                          buttonClass = 'bg-red-100 border-red-500 text-red-800';
                      }
                  } else if (userChoice === option) {
                      buttonClass = 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-300';
                  }
                  return (
                    <button key={index} onClick={() => !submitted && setUserChoice(option)} disabled={submitted}
                      className={`w-full text-left p-4 border rounded-lg transition-colors duration-200 flex items-center ${buttonClass}`}>
                      <span className="font-semibold mr-4">{index + 1}.</span> {option}
                    </button>
                  );
              })}
            </div>
            {submitted && (
                <div className="mt-6 p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                    <h4 className="font-bold text-indigo-700">{isCorrect ? "정답입니다! 🎉" : "아쉽네요, 다시 확인해보세요."}</h4>
                    <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{similarQuestion.explanation}</p>
                </div>
            )}
            <div className="flex justify-end space-x-4 mt-8">
              {!submitted ? (
                <button onClick={handleSubmit} disabled={!userChoice} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400">제출하기</button>
              ) : (
                <button onClick={() => setSimilarQuestionModalOpen(false)} className="px-6 py-2 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-800">닫기</button>
              )}
            </div>
          </div>
        </div>
      );
  };
  
  const renderInputScreen = () => (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center">
        <div className="flex items-center justify-center text-2xl font-bold text-gray-800 mb-4">
          <BookOpenIcon />
          <h1 >AI 수능 사회문화 퀴즈</h1>
        </div>
        <p className="text-gray-600 mb-8">엄선된 수능 사회문화 핵심 문제로 실력을 점검하고, AI의 상세한 해설로 약점을 완벽하게 보완해보세요!</p>
        <button onClick={startTest} className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105">퀴즈 시작하기</button>
      </div>
    </div>
  );

  const renderTestScreen = () => {
      const question = testQuestions[currentQuestionIndex];
      return (
        <div className="w-full max-w-3xl mx-auto">
             <div className="bg-white p-8 rounded-xl shadow-lg">
                <div className="mb-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-indigo-600">문제 {currentQuestionIndex + 1} / {testQuestions.length}</p>
                      {question.category && (
                        <span className="ml-2 inline-block text-xs font-bold px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">{question.category}</span>
                      )}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1"><div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / testQuestions.length) * 100}%` }}></div></div>
                </div>
                <p className="text-xl font-medium text-gray-800 my-6 whitespace-pre-wrap">{question.question}</p>
                {question.imageUrl && (
                    <div className="my-4 flex justify-center">
                        <img src={question.imageUrl} alt="Question visual aid" className="max-w-full rounded-lg shadow-md border" />
                    </div>
                )}
                <div className="space-y-3">
                    {question.options.map((option, index) => (
                        <button key={index} onClick={() => setCurrentAnswer(option)}
                            className={`w-full text-left p-4 border rounded-lg transition-colors duration-200 flex items-center ${ currentAnswer === option ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-300' : 'bg-white hover:bg-indigo-50 border-gray-300' }`}>
                           <span className="font-semibold mr-4">{index + 1}.</span> {option}
                        </button>
                    ))}
                </div>
                <button onClick={handleNextQuestion} disabled={!currentAnswer}
                    className="w-full mt-8 bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 transition-transform transform hover:scale-105">
                    {currentQuestionIndex < testQuestions.length - 1 ? '다음 문제' : '결과 확인'}
                </button>
            </div>
        </div>
      );
  };
  
  const renderResultsScreen = () => {
    const correctCount = results.filter(r => r.isCorrect).length;
    const incorrectResults = results.filter(r => !r.isCorrect);
    const stats = loadQuestionStats();

    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">테스트 결과</h2>
          <p className="text-center text-xl text-gray-600 mb-6">총 {results.length}문제 중 <span className="font-bold text-indigo-600">{correctCount}</span>개를 맞혔습니다!</p>
          
          {!aiAnalysis && (
            <div className="text-center mb-8">
                <button onClick={fetchAIAnalysis} disabled={isAnalysisLoading}
                    className="bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 transition-all transform hover:scale-105 flex items-center justify-center mx-auto">
                    <SparklesIcon /> {isAnalysisLoading ? 'AI가 분석 중...' : 'AI 총평 및 학습 조언 보기'}
                </button>
            </div>
          )}

          {aiAnalysis && (
             <div className="my-8 p-6 rounded-lg bg-purple-50 border border-purple-200">
                <h3 className="text-xl font-bold text-purple-800 mb-2 flex items-center"><LightBulbIcon/>AI 학습 컨설턴트</h3>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</p>
             </div>
          )}

          <div className="space-y-4 mb-8">
            {results.map((result, index) => (
              <div key={index} className={`border p-4 rounded-lg ${result.isCorrect ? 'border-gray-200' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">{result.isCorrect ? <CheckCircleIcon /> : <XCircleIcon />}</div>
                  <div className="ml-4 flex-grow">
                    <p className="font-semibold text-gray-800 whitespace-pre-wrap flex items-center">
                      <span>{index + 1}. {result.question}</span>
                      {result.category && (
                        <span className="ml-2 inline-block text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">{result.category}</span>
                      )}
                    </p>
                    {result.imageUrl && (
                        <div className="my-2">
                            <img src={result.imageUrl} alt="Question visual aid" className="max-w-xs rounded-md border" />
                        </div>
                    )}
                    <p className={`text-sm mt-2 ${result.isCorrect ? 'text-gray-500' : 'text-red-600'}`}><span className='font-bold'>내 선택:</span> {result.userAnswer || "선택 안 함"}</p>
                    {!result.isCorrect && (<p className="text-sm text-green-700 mt-1"><span className='font-bold'>정답:</span> {result.answer}</p>)}
                    {!result.isCorrect && (
                        <div className="mt-3">
                           <button onClick={() => fetchSimilarQuestion(result)} disabled={isSimilarQuestionLoading === result.id}
                                className="bg-white text-indigo-700 border border-indigo-600 text-sm font-bold py-2 px-4 rounded-lg hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 disabled:bg-gray-200 disabled:text-gray-500 transition-all flex items-center">
                                <SparklesIcon className="h-4 w-4 mr-1.5"/>
                                {isSimilarQuestionLoading === result.id ? '생성 중...' : 'AI 유사 문제 풀어보기'}
                           </button>
                        </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">누적 기록: 시도 {stats[result.id]?.attemptsCount ?? 0}회, 정답 {stats[result.id]?.correctCount ?? 0}회</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {incorrectResults.length > 0 && Object.keys(llmExplanations).length === 0 && (
            <div className="text-center mb-8">
                <button onClick={fetchLLMExplanations} disabled={isLoading}
                    className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 transition-all transform hover:scale-105 flex items-center justify-center mx-auto">
                    <SparklesIcon /> {isLoading ? 'AI가 설명 생성 중...' : '틀린 개념 AI에게 물어보기'}
                </button>
            </div>
          )}

          {error && <p className="text-red-500 text-center my-4">{error}</p>}

          {Object.keys(llmExplanations).length > 0 && (
             <div className="mt-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">🤖 AI 개념 해설</h3>
                 <div className="space-y-6">
                    {Object.entries(llmExplanations).map(([concept, explanation]) => (
                        <div key={concept} className="bg-indigo-50 p-6 rounded-lg border border-indigo-200">
                            <h4 className="text-lg font-bold text-indigo-800 mb-2">{concept}</h4>
                            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{explanation}</p>
                        </div>
                    ))}
                 </div>
             </div>
          )}
          
          <div className="text-center mt-12"><button onClick={resetApp} className="bg-gray-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-transform transform hover:scale-105">퀴즈 다시 풀기</button></div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-100 min-h-screen font-sans flex items-center justify-center p-4">
      {appState === 'input' && renderInputScreen()}
      {appState === 'test' && renderTestScreen()}
      {appState === 'results' && renderResultsScreen()}
      <SimilarQuestionModal />
    </div>
  );
}


import React from "react";

export default function QuestionPrompt({ question, onAnswer }) {
  if (!question || !question.questions || question.questions.length === 0) return null;

  const handleSubmit = (questionIndex, optionIndex) => {
    const answers = question.questions.map((q, i) => {
      if (i === questionIndex) {
        return [q.options[optionIndex]?.label];
      }
      return [];
    });
    const selectedOption = question.questions[questionIndex]?.options[optionIndex];
    onAnswer(question.id, answers, {
      question: question.questions[questionIndex]?.question,
      header: question.questions[questionIndex]?.header,
      answer: selectedOption?.label,
      description: selectedOption?.description,
    });
  };

  return (
    <div id="question-prompt">
      {question.questions.map((q, qIndex) => (
        <div key={qIndex} className="question-block">
          {q.header && <div className="question-header">{q.header}</div>}
          <div className="question-text">{q.question}</div>
          {q.options && q.options.length > 0 && (
            <div className="question-options">
              {q.options.map((opt, oIndex) => (
                <button
                  key={oIndex}
                  className="question-option"
                  onClick={() => handleSubmit(qIndex, oIndex)}
                >
                  <span className="option-label">{opt.label}</span>
                  {opt.description && (
                    <span className="option-description">{opt.description}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

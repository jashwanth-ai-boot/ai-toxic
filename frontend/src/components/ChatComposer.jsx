import React from 'react';

export default function ChatComposer({
  prompt,
  promptInputRef,
  loading,
  isListening,
  showCreateFormats,
  voiceError,
  chatError,
  onPromptChange,
  onSubmit,
  onStop,
  onVoice,
  onOpenFormats,
  onUseFormat,
  onCloseFormats,
}) {
  return (
    <section className="composer-panel panel" aria-labelledby="conversation-title">
      <div className="signal-header">
        <div className="signal-orb"><span /></div>
        <div><p className="eyebrow">TOXIC SIGNAL / LIVE</p><p className="signal-copy">Listening for your next move</p></div>
        <div className="signal-bars" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
        <span className="signal-status">{loading ? 'WORKING' : 'READY'}</span>
      </div>
      <div className="section-heading">
        <div><p className="eyebrow">NEURAL INTAKE</p><h2 id="conversation-title">What are we making today?</h2></div>
        <div className="conversation-tools">
          <button type="button" className={`robot-button ${showCreateFormats ? 'is-open' : ''}`} onClick={onOpenFormats} aria-label="Open create formats" title="Open create formats"><span className="robot-antenna" /><span className="robot-eyes"><i /><i /></span><span className="robot-mouth" /></button>
          <span className="command-hint">⌘ ↵</span>
        </div>
      </div>
      {showCreateFormats && <div className="create-formats" role="group" aria-label="Create formats"><span>CREATE FORMAT</span><button type="button" onClick={() => onUseFormat('Write a clear plan for ')}>Plan</button><button type="button" onClick={() => onUseFormat('Draft a professional message about ')}>Draft</button><button type="button" onClick={() => onUseFormat('Brainstorm creative ideas for ')}>Ideas</button><button type="button" className="close-formats" onClick={onCloseFormats} aria-label="Close create formats">×</button></div>}
      <form onSubmit={onSubmit} className="composer-form">
        <textarea ref={promptInputRef} value={prompt} onChange={onPromptChange} rows="1" placeholder="Ask, create, plan, or explore..." className="composer-input" aria-label="Message Toxic AI" />
        <button type="button" onClick={onVoice} disabled={isListening || loading} aria-label={isListening ? 'Listening' : 'Use voice input'} title={isListening ? 'Listening...' : 'Use voice input'} className={`voice-button ${isListening ? 'is-listening' : ''}`}>{isListening ? '●' : '◉'}</button>
        <button type={loading ? 'button' : 'submit'} onClick={loading ? onStop : undefined} disabled={!loading && !prompt.trim()} className={`send-button ${loading ? 'is-stopping' : ''}`}>{loading ? 'Stop' : 'Send'} <span className={loading ? 'stop-glyph' : 'send-glyph'} aria-hidden="true" /></button>
      </form>
      {voiceError && <p className="form-message error-message" role="alert">{voiceError}</p>}
      {chatError && <p className="form-message error-message" role="alert"><strong>Response failed.</strong> {chatError}</p>}
    </section>
  );
}

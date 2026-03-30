  // Cole este bloco substituindo o try inteiro dentro de sendMessage no chat.html

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history: conversationHistory.slice(),
        chatHistory: displayHistory.slice(),
        userName: USER_NAME,
        email: USER_EMAIL,
        memory: localStorage.getItem('ap_memory') || ''
      })
    });

    const data = await res.json();
    removeTyping();

    if (!res.ok || data.error) {
      throw new Error(data.error || 'Server error');
    }

    const reply = data.reply;
    const angelTime = getTime();
    appendMsg(reply, 'angel', angelTime);
    recordTurn('angel', reply, angelTime);

    // Chama update-memory de forma independente (fire and forget)
    // Roda DEPOIS que o usuário já recebeu a resposta — sem afetar velocidade
    if (USER_EMAIL && data.mergedHistory?.length >= 4) {
      const recentForMemory = data.mergedHistory.slice(-10);
      fetch('/api/update-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: USER_EMAIL,
          userName: USER_NAME,
          recentMessages: recentForMemory
        })
      }).catch(() => {}); // silencia erros — não é crítico
    }

  } catch (err) {
    removeTyping();
    console.error(err);
    const errMsg = 'I am sensing a disturbance in the connection right now. Please wait a moment and speak to me again.';
    appendMsg(errMsg, 'angel');
  } finally {
    sendBtn.disabled = false;
    msgInput.disabled = false;
    msgInput.focus();
    document.getElementById('angelStatus').textContent = 'Always listening, always present';
  }

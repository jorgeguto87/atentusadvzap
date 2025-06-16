const links = document.querySelectorAll(".menu a");
const main = document.querySelector("main");

function carregarPagina(pagina) {
  fetch(`pages/${pagina}.html`)
    .then(response => response.text())
    .then(html => {
      main.innerHTML = html;
      inicializarElementosPagina();
    })
    .catch(() => {
      main.innerHTML = "<p>Erro ao carregar conteúdo.</p>";
    });
}

function inicializarElementosPagina() {
  const button = document.getElementById('emoji-button');
  const picker = document.getElementById('emoji-picker');
  const textarea = document.getElementById('input_text');

  const emojis = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇',
    '🙂','🙃','😉','😍','🥰','😘','😗','😙','😚','😎',
    '🤩','🥳','😏','😋','😜','🤪','😝','🤑','🤗','👍',
    '👎','👌','✌️','🤞','🤟','🤘','🤙','👋','👏','🙏',
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
    '🔥','✨','⚡','💥','⭐','🎉','🎊','🎈','🥳','🎂',
    '🍾','🥂','🍻','🍹','🍕','🍔','🍟','🌮','🍩','🍪',
    '💼','📈','📉','📊','💰','💵','💳','🧾','📜','📝',
    '📅','⏰','📢','📞','📱','✔️','❌','⚠️','🚫','✅',
    '❗','❓','💡','🔔','🎯','🚀'
  ];

  if (button && picker && textarea) {
    function criarPicker() {
      picker.innerHTML = '';
      emojis.forEach(emoji => {
        const span = document.createElement('span');
        span.textContent = emoji;
        span.addEventListener('click', () => {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const text = textarea.value;
          textarea.value = text.slice(0, start) + emoji + text.slice(end);
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
          picker.style.display = 'none';
        });
        picker.appendChild(span);
      });
    }

    button.addEventListener('click', () => {
      if (picker.style.display === 'none') {
        criarPicker();
        const rect = button.getBoundingClientRect();
        picker.style.position = 'absolute';
        picker.style.top = (rect.bottom + window.scrollY) + 'px';
        picker.style.left = (rect.left + window.scrollX) + 'px';
        picker.style.display = 'flex';
      } else {
        picker.style.display = 'none';
      }
    });

    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target) && e.target !== button) {
        picker.style.display = 'none';
      }
    });
  }

  const uploadButton = document.getElementById('upload-button');
  if (uploadButton) {
    uploadButton.addEventListener('click', async () => {
      const fileInput = document.getElementById('file-input');
      const file = fileInput?.files[0];
      const diaSemana = document.getElementById('diaSemana')?.value;

      function exibirStatus(id, texto) {
        const campo = document.getElementById(id);
        if (campo) campo.innerHTML = texto;
      }

      if (!file) {
        exibirStatus('status_documents', 'Nenhum arquivo selecionado');
        return;
      }

      const formData = new FormData();
      formData.append('arquivo', file);
      formData.append('diaSemana', diaSemana);

      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      exibirStatus('status_documents', data.message);
    });
  }

  const fileInput = document.getElementById('file-input');
  const imagem = document.getElementById('previewImagem');
  if (fileInput && imagem) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => imagem.src = reader.result;
        reader.readAsDataURL(file);
      }
    });
  }

  const campoMensagem = document.getElementById('input_text');
  const uploadText = document.getElementById('upload_text');
  const previewText = document.getElementById('previewText');

  if (campoMensagem && uploadText && previewText) {
    uploadText.addEventListener('click', () => {
      const semanaMensagem = document.getElementById('diaSemana');
      let mensagem;
      if (semanaMensagem) {
        const valor = semanaMensagem.value;
        mensagem = valor;
      }
      const dados = { mensagemSemana: mensagem, mensagem: campoMensagem.value };

      function exibirStatus(id, texto) {
        const campo = document.getElementById(id);
        if (campo) campo.textContent = texto;
      }

      fetch('/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      })
        .then(res => res.text())
        .then(() => exibirStatus('status_text', 'Dados salvos com sucesso'))
        .catch(err => console.error('Erro:', err));
    });

    campoMensagem.addEventListener('input', () => {
      const textoComQuebras = campoMensagem.value.replace(/\n/g, '<br>');
      previewText.innerHTML = textoComQuebras;
    });
    
  }

  const diaSemanaSelect = document.getElementById('diaSemana');
  if (diaSemanaSelect) {
    diaSemanaSelect.addEventListener('change', () => {
      const statusDocs = document.getElementById('status_documents');
      const statusText = document.getElementById('status_text');
      const previewImagem = document.getElementById('previewImagem');
      const inputText = document.getElementById('input_text');
      const previewText = document.getElementById('previewText');

      if (statusDocs) statusDocs.innerHTML = '';
      if (statusText) statusText.innerHTML = '';
      if (fileInput) fileInput.value = '';
      if (previewImagem) previewImagem.src = 'default_preview.jpg';
      if (inputText) inputText.value = '';
      if (previewText) previewText.innerHTML = '';
    });
  }
  // Gerador de Links do WhatsApp
  const inputNumero = document.getElementById('input_gen_number');
  const inputTexto = document.getElementById('input_gen_text');
  const botaoGerar = document.getElementById('gerar_link');
  const statusLink = document.getElementById('status_link');

  if (inputNumero && inputTexto && botaoGerar && statusLink) {
    botaoGerar.addEventListener('click', () => {
      const numero = inputNumero.value.trim();
      const texto = inputTexto.value.trim();

      if (!numero || !/^55\d{11}$/.test(numero)) {
        statusLink.innerText = '❌ Número inválido. Use o formato 55DD9XXXXXXXX.';
        return;
      }

      const textoCodificado = encodeURIComponent(texto);
      const link = `https://wa.me/${numero}?text=${textoCodificado}`;
      statusLink.innerHTML = `<a href="${link}" target="_blank">${link}</a>`;
    });
  }

  // Scripts específicos de páginas futuras podem ir aqui:
    // Scripts específicos de páginas futuras podem ir aqui:
    let isRestarting = false;
let isLoggingOut = false;
let intervalId = null;

if (document.getElementById('qrcode')) {
  const qrcodeImg = document.getElementById('qrcode');
  const title = document.getElementById('title');
  const subtitle = document.getElementById('subtitle');
  const loading = document.getElementById('loading');
  const statusText = document.getElementById('status');

  async function checkStatus() {
    try {
      const res = await fetch('/status');
      const data = await res.json();

      if (data.connected) {
        qrcodeImg.style.display = 'none';
        loading.style.display = 'none';
        title.textContent = '✅ Conectado com Sucesso!';
        subtitle.textContent = 'Você já pode fechar esta página.';

        // Libera exibição normal novamente
        if (isRestarting || isLoggingOut) {
          statusText.textContent = '✅ Conectado com sucesso!';
        } else {
          statusText.textContent = '';
        }

        // Reset flags e reativa o checkStatus se estiver pausado
        isRestarting = false;
        isLoggingOut = false;
        restartCheckStatusInterval();

      } else {
        if (data.qr) {
          qrcodeImg.src = data.qr;
          qrcodeImg.style.display = 'block';
        }
        loading.style.display = 'block';

        if (!isRestarting && !isLoggingOut) {
          statusText.textContent = 'Aguardando conexão com o WhatsApp...';
        }
      }
    } catch (err) {
      console.error('Erro ao verificar status:', err);
    }
  }

  function startCheckStatusInterval() {
    if (!intervalId) {
      intervalId = setInterval(checkStatus, 3000);
    }
  }

  function stopCheckStatusInterval() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function restartCheckStatusInterval() {
    stopCheckStatusInterval();
    startCheckStatusInterval();
  }

  async function restartBot() {
    stopCheckStatusInterval();
    isRestarting = true;
    statusText.textContent = "♻️ Reiniciando, aguarde por favor...";
    loading.style.display = 'block';

    try {
      const res = await fetch('/restart', { method: 'POST' });
      const data = await res.json();

      if (data.message) {
        statusText.textContent = data.message;
        title.textContent = '✅ Reiniciado com sucesso!';
        
      } else {
        statusText.textContent = "Reiniciando, aguarde até a confirmação...";
      }

      // Reativa monitoramento após delay pequeno
      setTimeout(() => startCheckStatusInterval(), 3000);

    } catch (error) {
      statusText.textContent = "Erro ao reiniciar...";
      loading.style.display = 'none';
      console.error(error);
      isRestarting = false;
      startCheckStatusInterval();
    }
  }

  async function logoutBot() {
    stopCheckStatusInterval();
    isLoggingOut = true;
    statusText.textContent = "🚪 Desconectando, aguarde...";
    loading.style.display = 'block';

    try {
      const res = await fetch('/logout', { method: 'POST' });
      const data = await res.json();
      statusText.textContent = data.message;
      title.textContent = '❎ Desconectado!';

      // Reativa verificação depois de um tempo
      setTimeout(() => startCheckStatusInterval(), 3000);

    } catch (error) {
      statusText.textContent = "Erro ao desconectar...";
      loading.style.display = 'none';
      console.error(error);
      isLoggingOut = false;
      startCheckStatusInterval();
    }
  }

  // Botões
  const btnReconnect = document.getElementById('reconnect');
  const btnLogout = document.getElementById('logout');

  if (btnReconnect) btnReconnect.addEventListener('click', restartBot);
  if (btnLogout) btnLogout.addEventListener('click', logoutBot);

  // Inicialização
  checkStatus();
  startCheckStatusInterval();
}

// ⏰ Horários (incluir dentro da função inicializarElementosPagina)
const selects = [
  'chooseHours1', 'chooseHours2', 'chooseHours3',
  'chooseHours4', 'chooseHours5', 'chooseHours6'
];

const statusEl = document.getElementById('statushorarios');
const listaEl = document.getElementById('horarios_escolhidos');
const btnConfirmar = document.getElementById('confirmar_horas');

if (btnConfirmar && listaEl && statusEl) {
  const textoOriginalBotao = btnConfirmar.innerText;

  function carregarHorarios() {
    fetch('/horarios')
      .then(res => res.json())
      .then(data => {
        const lista = data.horarios || [];
        listaEl.innerText = lista.map(h => `${h}:00`).join(' | ');
      })
      .catch(() => {
        listaEl.innerText = 'Erro ao carregar horários';
      });
  }

  btnConfirmar.addEventListener('click', () => {
    const valores = selects.map(id => {
      const el = document.getElementById(id);
      return el ? el.value : null;
    }).filter(v => v !== 'null' && v !== null);

    const unicos = [...new Set(valores.map(Number))].sort((a, b) => a - b);

    if (unicos.length === 0) {
      statusEl.innerText = '⚠️ Selecione pelo menos um horário';
      return;
    }

    btnConfirmar.disabled = true;
    btnConfirmar.innerText = 'Salvando...';

    fetch('/horarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horarios: unicos })
    })
      .then(res => res.json())
      .then(data => {
        statusEl.innerText = '✅ Horários salvos com sucesso!';
        listaEl.innerText = data.horarios.map(h => `${h}:00`).join(' | ');
      })
      .catch(() => {
        statusEl.innerText = '❌ Erro ao salvar os horários';
      })
      .finally(() => {
        btnConfirmar.disabled = false;
        btnConfirmar.innerText = textoOriginalBotao;
      });
  });

  carregarHorarios();
}

if (document.getElementById('confirmar_grupos')) {
  const tabelaEsquerda = document.getElementById('tabela_grupos_esquerda');
  const tabelaDireita = document.getElementById('tabela_grupos_direita');
  const btnConfirmarGrupos = document.getElementById('confirmar_grupos');

  // Limpa quaisquer linhas existentes
  tabelaEsquerda.innerHTML = '';
  tabelaDireita.innerHTML = '';

  // Busca os grupos do backend
  fetch('/grupos')
    .then(res => res.json())
    .then(grupos => {
      grupos.forEach(grupo => {
        const tr = document.createElement('tr');

        let idParte = grupo.id;
        let nomeParte = '';

        if (grupo.id.includes(' - ')) {
        [idParte, nomeParte] = grupo.id.split(' - ');
        }

        const tdId = document.createElement('td');
        tdId.textContent = idParte;

        const tdNome = document.createElement('td');
        tdNome.textContent = nomeParte;

        const tdCheck = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', atualizarGruposSelecionados);

        tdCheck.appendChild(checkbox);

        tr.appendChild(tdId);
        tr.appendChild(tdNome);
        tr.appendChild(tdCheck);

        tabelaEsquerda.appendChild(tr);
        
        //setInterval(tr, 3000);
      });
    });

  function atualizarGruposSelecionados() {
    tabelaDireita.innerHTML = '';

    const linhas = tabelaEsquerda.querySelectorAll('tr');
    linhas.forEach(tr => {
      const checkbox = tr.querySelector('input[type="checkbox"]');
      if (checkbox && checkbox.checked) {
        const trNovo = document.createElement('tr');

        const tdId = document.createElement('td');
        tdId.textContent = tr.children[0].textContent;

        const tdNome = document.createElement('td');
        tdNome.textContent = tr.children[1].textContent;

        trNovo.appendChild(tdId);
        trNovo.appendChild(tdNome);

        tabelaDireita.appendChild(trNovo);
      }
    });
  }

  btnConfirmarGrupos.addEventListener('click', () => {
    const linhasSelecionadas = tabelaDireita.querySelectorAll('tr');
    const gruposSelecionados = Array.from(linhasSelecionadas).map(tr => ({
      id: tr.children[0].textContent,
      nome: tr.children[1].textContent
    }));

    fetch('/grupos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gruposSelecionados)
    })
      .then(res => res.json())
      .then(data => {
        alert(data.message);
      })
      .catch(err => {
        alert('Erro ao salvar os grupos');
        console.error(err);
      });
  });
}

//meusanuncios
if (document.getElementById('tabela_grupos_check')) {
  fetch('/gruposcheck')
    .then(res => res.json())
    .then(grupos => {
      const tbody = document.getElementById('tabela_grupos_check');
      tbody.innerHTML = ''; // limpa antes de preencher (opcional)

      grupos.forEach(grupo => {
        const tr = document.createElement('tr');

        const tdId = document.createElement('td');
        tdId.textContent = grupo.id;

        const tdNome = document.createElement('td');
        tdNome.textContent = grupo.nome;

        tr.appendChild(tdId);
        tr.appendChild(tdNome);

        tbody.appendChild(tr);
      });
    })
    .catch(error => {
      console.error('Erro ao carregar os grupos:', error);
    });
}
if (document.getElementById('previewImagem_chk')) {
  const selectDia = document.getElementById('diaSemana_chk');
  const imagem = document.getElementById('previewImagem_chk');
  const texto = document.getElementById('previewText_chk');

  if (selectDia && imagem && texto) {
    // Carregar grupos na tabela
    
    // Função para carregar prévia
    const carregarPreview = (dia) => {
      fetch(`/anuncio/${dia}`)
        .then(res => res.json())
        .then(data => {
          imagem.src = data.imagemBase64 || '';
          texto.textContent = data.texto || '';
        })
        .catch(err => console.error('Erro ao carregar anúncio:', err));
    };

    // Carrega a primeira vez
    carregarPreview(selectDia.value);

    // Atualiza ao mudar
    selectDia.addEventListener('change', () => {
      carregarPreview(selectDia.value);
    });
  }
}

//duplicar anuncios meusanuncios

//document.addEventListener('DOMContentLoaded', () => {
  
  if (document.getElementById('confirmar_checkbox')) {
    const btnConfirmar = document.getElementById('confirmar_checkbox');
    btnConfirmar.addEventListener('click', () => {
      const selectDia = document.getElementById('diaSemana_chk');
      const diaOrigem = selectDia.value;

      // Pegar todos os checkboxes marcados
      const checkboxes = document.querySelectorAll('.main__checkbox');
      const diasDestino = [];

      checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
          // Extrair o dia do id, que está no formato checkbox_segunda, checkbox_terca, etc
          const dia = checkbox.id.replace('checkbox_', '');
          // Evita copiar para o mesmo dia origem
          if (dia !== diaOrigem) diasDestino.push(dia);
        }
      });

      if (diasDestino.length === 0) {
        alert('Selecione pelo menos um dia diferente para copiar o anúncio.');
        return;
      }

      fetch('/copiar-anuncio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ diaOrigem, diasDestino })
      })
      .then(res => {
        if (!res.ok) throw new Error('Erro ao copiar anúncio');
        return res.text();
      })
      .then(msg => {
        alert(msg);
        // Opcional: desmarcar checkboxes após confirmação
        checkboxes.forEach(c => c.checked = false);
      })
      .catch(err => {
        console.error(err);
        alert('Erro ao copiar anúncio. Veja o console.');
      });
    });
  //}
};


  // if (main.innerHTML.includes("id_exclusivo_da_nova_pagina")) { ... }
}

// Configura os links do menu
links.forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    const pagina = e.target.getAttribute("data-page");
    carregarPagina(pagina);
  });
});

// Carrega página inicial
document.addEventListener("DOMContentLoaded", () => {
  carregarPagina("anuncios");
});

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const cron = require('node-cron');

const app = express();
const PORT = 3040;

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let qrBase64 = '';
let isConnected = false;
let client;

const diaMap = {
  1: 'segunda',
  2: 'terca',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sabado'
};

const imagemMap = {
  1: 'diaum',
  2: 'diadois',
  3: 'diatres',
  4: 'diaquatro',
  5: 'diacinco',
  6: 'diaseis'
};

function lerHorarios() {
  const filePath = path.join(__dirname, 'horarios.txt');
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h));
}

function lerGruposDestinatarios() {
  const filePath = path.join(__dirname, 'grupos_check.txt');
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .map(l => l.split('|')[0]?.trim())
    .filter(id => id && id.endsWith('@g.us'));
}


function lerMensagensDataTxt() {
  const filePath = path.join(__dirname, 'data.txt');
  if (!fs.existsSync(filePath)) return {};
  const linhas = fs.readFileSync(filePath, 'utf-8').split('\n');
  const mapa = {};
  for (const linha of linhas) {
    const [dia, ...msg] = linha.split(':');
    if (dia && msg.length > 0) {
      mapa[dia.trim()] = msg.join(':').trim().replace(/\\n/g, '\n');
    }
  }
  return mapa;
}

async function startClient() {
  client = new Client({
    authStrategy: new LocalAuth({ clientId: 'atentusadv' }),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', async qr => {
    qrBase64 = await qrcode.toDataURL(qr);
    isConnected = false;
    console.log('📲 Novo QR Code gerado.');
  });

  client.on('ready', () => {
    isConnected = true;
    console.log('✅ Chatbot conectado com sucesso!');
    escutarGrupos();
    agendarEnvios();
  });

  client.on('disconnected', () => {
    isConnected = false;
    console.log('❌ Cliente desconectado.');
  });

  await client.initialize();
}

startClient();



async function restartClient() {
  if (client) await client.destroy();
  await startClient();
}

async function logoutClient() {
  if (client) {
    await client.logout();
    await client.destroy();
  }
  const sessionPath = path.join(__dirname, '.wwebjs_auth', 'atentusadv');
  if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
  isConnected = false;
  await startClient();
}

function escutarGrupos() {
  client.on('message', async msg => {
    const from = msg.from;
    if (from.endsWith('@g.us')) {
      const chat = await msg.getChat();
      const nomeGrupo = chat.name;
      const registro = `${from} - ${nomeGrupo}`;
      const arquivo = path.join(__dirname, 'grupos_scan.txt');
      const existente = fs.existsSync(arquivo) ? fs.readFileSync(arquivo, 'utf-8') : '';
      if (!existente.includes(from)) {
        fs.appendFileSync(arquivo, registro + '\n', 'utf-8');
        console.log(`📁 Grupo salvo: ${registro}`);
      }
    }
  });
}

function agendarEnvios() {
  console.log('📅 Função de agendamento registrada');
  let enviadosHoje = new Set();

  cron.schedule('0 * * * *', async () => {
    console.log('🕒 Agendamento ativado!');
    const agora = new Date();
    const hora = agora.getHours();
    const dia = agora.getDay(); // 0 = domingo

    console.log(`📆 Dia: ${dia} | Hora: ${hora}`);

    if (dia === 0) {
      console.log('⛔ Domingo. Nenhum envio será feito.');
      return;
    }

    const horarios = lerHorarios();
    console.log('📂 Horários cadastrados:', horarios);

    if (!horarios.includes(hora)) {
      console.log(`⏱️ Hora ${hora} não está nos horários programados.`);
      return;
    }

    const chaveEnvio = `${dia}-${hora}`;
    if (enviadosHoje.has(chaveEnvio)) {
      console.log('🔁 Já enviado neste horário. Ignorando...');
      return;
    }

    const nomeImagemBase = imagemMap[dia];
    const nomeMensagem = diaMap[dia];

    if (!nomeImagemBase || !nomeMensagem) {
      console.log('⚠️ Dia não mapeado corretamente:', dia);
      return;
    }

    const mensagemMap = lerMensagensDataTxt();
    console.log('📜 Mapa de mensagens:', mensagemMap);

    const texto = mensagemMap[nomeMensagem];
    console.log(`📄 Texto para ${nomeMensagem}:`, texto);

    const exts = ['.jpg', '.png'];
    let caminhoImagem = null;
    let imagemExt = '';

    for (const ext of exts) {
      const tentativa = path.join(assetsDir, `${nomeImagemBase}${ext}`);
      if (fs.existsSync(tentativa)) {
        caminhoImagem = tentativa;
        imagemExt = ext;
        break;
      }
    }

    if (!caminhoImagem) {
      console.log(`🖼️ Imagem não encontrada para ${nomeImagemBase}`);
    } else {
      console.log(`🖼️ Imagem encontrada: ${caminhoImagem}`);
    }

    if (!caminhoImagem || !texto) {
      console.log(`⚠️ Conteúdo incompleto para ${nomeMensagem.toUpperCase()}. Imagem ou texto ausente.`);
      return;
    }

    try {
      const media = MessageMedia.fromFilePath(caminhoImagem);
      const grupos = lerGruposDestinatarios();
      console.log(`📣 Enviando para grupos:, \n${grupos}`);

      for (const grupoId of grupos) {
        try {
          await client.sendMessage(grupoId, media, { caption: texto });
          console.log(`✅ Mensagem enviada para ${grupoId} (${nomeMensagem})`);
        } catch (erroEnvio) {
          console.error(`❌ Erro ao enviar para ${grupoId}:`, erroEnvio.message);
        }
      }

      enviadosHoje.add(chaveEnvio); // marca como enviado
    } catch (erroGeral) {
      console.error(`❌ Erro no processo de envio para ${nomeMensagem}:`, erroGeral.message);
    }
  });
}


// ROTAS ==================================================

app.get('/index', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/qrcode', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'conexao.html'));
});

app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    qr: isConnected ? null : qrBase64
  });
});

app.post('/restart', async (req, res) => {
  await restartClient();
  res.json({ message: 'Reiniciado com sucesso.' });
});

app.post('/logout', async (req, res) => {
  await logoutClient();
  res.json({ message: 'Logout concluído. QR code aguardando...' });
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload', upload.single('arquivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado' });

  const diaSemana = req.body.diaSemana?.toLowerCase();
  const nomeBase = {
    segunda: 'diaum',
    terca: 'diadois',
    quarta: 'diatres',
    quinta: 'diaquatro',
    sexta: 'diacinco',
    sabado: 'diaseis'
  }[diaSemana] || 'desconhecido';

  const ext = path.extname(req.file.originalname);
  const nomeFinal = `${nomeBase}${ext}`;
  const caminhoFinal = path.join(assetsDir, nomeFinal);

  fs.writeFile(caminhoFinal, req.file.buffer, err => {
    if (err) return res.status(500).json({ message: 'Erro ao salvar' });
    res.json({ message: 'Arquivo salvo com sucesso', filename: nomeFinal });
  });
});

app.post('/salvar', (req, res) => {
  const { mensagemSemana, mensagem } = req.body;
  const textoFormatado = mensagem.replace(/\r?\n/g, '\\n');
  const novaLinha = `${mensagemSemana}: ${textoFormatado}`;
  const filePath = path.join(__dirname, 'data.txt');

  const ordemDias = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

  fs.readFile(filePath, 'utf8', (err, data) => {
    let linhas = data ? data.split('\n').filter(Boolean) : [];
    const mapa = {};
    for (const linha of linhas) {
      const [dia, ...resto] = linha.split(':');
      if (ordemDias.includes(dia.trim())) {
        mapa[dia.trim()] = resto.join(':').trim();
      }
    }

    mapa[mensagemSemana] = textoFormatado;
    const novoConteudo = ordemDias.filter(dia => mapa[dia]).map(d => `${d}: ${mapa[d]}`).join('\n');

    fs.writeFile(filePath, novoConteudo + '\n', err => {
      if (err) return res.status(500).send('Erro ao salvar dados');
      res.status(200).send('Dados salvos com sucesso');
    });
  });
});

app.post('/horarios', (req, res) => {
  const { horarios } = req.body;

  if (!Array.isArray(horarios) || horarios.length === 0) {
    return res.status(400).json({ message: 'Horários inválidos' });
  }

  const unicos = [...new Set(horarios.map(h => parseInt(h)).filter(h => !isNaN(h)))];
  const ordenados = unicos.sort((a, b) => a - b);

  fs.writeFileSync(path.join(__dirname, 'horarios.txt'), ordenados.join(','), 'utf-8');

  res.status(200).json({ message: 'Horários atualizados com sucesso', horarios: ordenados });
});

app.get('/horarios', (req, res) => {
  const horarios = lerHorarios();
  res.json({ horarios });
});

app.get('/grupos', (req, res) => {
  const caminho = './grupos_scan.txt';
  if (!fs.existsSync(caminho)) return res.json([]);

  const dados = fs.readFileSync(caminho, 'utf-8');
  const grupos = dados
    .split('\n')
    .filter(Boolean)
    .map(linha => {
      const [id, nome] = linha.split('|').map(x => x.trim());
      return { id, nome };
    });

  res.json(grupos);
});

// POST /grupos – salva no grupos_check.txt
app.post('/grupos', (req, res) => {
  const grupos = req.body;
  const texto = grupos.map(g => `${g.id} | ${g.nome}`).join('\n');
  fs.writeFileSync('./grupos_check.txt', texto, 'utf-8');
  res.json({ message: 'Grupos salvos com sucesso!' });
});

//meusanuncios

app.get('/gruposcheck', (req, res) => {
  const gruposPath = path.join(__dirname, 'grupos_check.txt');

  if (!fs.existsSync(gruposPath)) {
    return res.json([]); // Retorna array vazio se o arquivo não existir
  }

  const linhas = fs.readFileSync(gruposPath, 'utf-8').split('\n').filter(Boolean);
  const grupos = linhas.map(linha => {
    const [id, nome] = linha.split('|').map(p => p.trim());
    return { id, nome };
  });

  res.json(grupos);
});

//meusanuncios preview

app.get('/anuncio/:dia', (req, res) => {
  const nomesDias = {
    segunda: 'diaum',
    terca: 'diadois',
    quarta: 'diatres',
    quinta: 'diaquatro',
    sexta: 'diacinco',
    sabado: 'diaseis'
  };

  const dia = req.params.dia.toLowerCase();
  const nomeImagem = nomesDias[dia];
  if (!nomeImagem) return res.status(400).json({ error: 'Dia inválido' });

  const exts = ['jpg', 'png'];
  let imagemPath = null;
  for (const ext of exts) {
    const caminho = path.join(__dirname, 'assets', `${nomeImagem}.${ext}`);
    if (fs.existsSync(caminho)) {
      imagemPath = caminho;
      break;
    }
  }

  const imagemBase64 = imagemPath
    ? `data:image/${path.extname(imagemPath).substring(1)};base64,${fs.readFileSync(imagemPath, 'base64')}`
    : '';

  // função para ler mensagens do data.txt
  const lerMensagensDataTxt = () => {
    const dataPath = path.join(__dirname, 'data.txt');
    const mapa = {};
    if (fs.existsSync(dataPath)) {
      const conteudo = fs.readFileSync(dataPath, 'utf-8');
      const linhas = conteudo.split('\n').filter(Boolean);
      for (const linha of linhas) {
        const [diaTxt, ...resto] = linha.split(':');
        if (diaTxt && resto.length) {
          mapa[diaTxt.trim()] = resto.join(':').replace(/\\n/g, '\n').trim();
        }
      }
    }
    return mapa;
  };

  const mapaMensagens = lerMensagensDataTxt();
  const texto = mapaMensagens[dia] || '';

  res.json({ texto, imagemBase64 });
});

//meusanuncios duplicar
app.post('/copiar-anuncio', (req, res) => {
  try {
    const { diaOrigem, diasDestino } = req.body;

    if (!diaOrigem || !diasDestino || !Array.isArray(diasDestino)) {
      return res.status(400).send('Parâmetros inválidos');
    }

    const nomesDias = { segunda: 'diaum', terca: 'diadois', quarta: 'diatres', quinta: 'diaquatro', sexta: 'diacinco', sabado: 'diaseis' };

    const nomeOrigem = nomesDias[diaOrigem];
    if (!nomeOrigem) return res.status(400).send('Dia de origem inválido');

    const exts = ['.jpg', '.png'];
    let imagemOrigemPath = null;
    let extensao = '';

    for (const ext of exts) {
      const caminho = path.join(__dirname, 'assets', `${nomeOrigem}${ext}`);
      if (fs.existsSync(caminho)) {
        imagemOrigemPath = caminho;
        extensao = ext;
        break;
      }
    }
    if (!imagemOrigemPath) return res.status(404).send('Imagem de origem não encontrada');

    const mensagens = lerMensagensDataTxt();

    const textoOrigem = mensagens[diaOrigem];
    if (!textoOrigem) return res.status(404).send('Mensagem de origem não encontrada');

    diasDestino.forEach(dest => {
      const nomeDestino = nomesDias[dest];
      if (!nomeDestino) return;

      const destinoPath = path.join(__dirname, 'assets', `${nomeDestino}${extensao}`);
      fs.copyFileSync(imagemOrigemPath, destinoPath);

      mensagens[dest] = textoOrigem;
    });

    const ordemDias = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const novaData = ordemDias
      .map(dia => mensagens[dia] ? `${dia}: ${mensagens[dia].replace(/\n/g, '\\n')}` : null)
      .filter(Boolean)
      .join('\n');

    fs.writeFileSync(path.join(__dirname, 'data.txt'), novaData + '\n');

    res.send('Anúncio copiado com sucesso.');
  } catch (error) {
    console.error('Erro em /copiar-anuncio:', error);
    res.status(500).send('Erro interno no servidor');
  }
});

//apagar anuncio
app.post('/apagar-anuncio', (req, res) => {
  try {
    const { dia } = req.body;

    if (!dia) return res.status(400).send('Dia não informado.');

    const nomesDias = { segunda: 'diaum', terca: 'diadois', quarta: 'diatres', quinta: 'diaquatro', sexta: 'diacinco', sabado: 'diaseis' };
    const nomeArquivo = nomesDias[dia];

    if (!nomeArquivo) return res.status(400).send('Dia inválido.');

    // Apagar imagem do dia
    const exts = ['.jpg', '.png'];
    for (const ext of exts) {
      const caminho = path.join(__dirname, 'assets', `${nomeArquivo}${ext}`);
      if (fs.existsSync(caminho)) fs.unlinkSync(caminho);
    }

    // Apagar texto do dia
    const mensagens = lerMensagensDataTxt();
    delete mensagens[dia];

    const ordemDias = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const novaData = ordemDias
      .map(d => mensagens[d] ? `${d}: ${mensagens[d].replace(/\n/g, '\\n')}` : null)
      .filter(Boolean)
      .join('\n');

    fs.writeFileSync(path.join(__dirname, 'data.txt'), novaData + '\n');

    res.send(`Anúncio apagado com sucesso.`);
  } catch (error) {
    console.error('Erro em /apagar-anuncio:', error);
    res.status(500).send('Erro interno no servidor');
  }
});

//apagar todos
app.post('/apagar-todos-anuncios', (req, res) => {
  try {
    const nomesDias = { segunda: 'diaum', terca: 'diadois', quarta: 'diatres', quinta: 'diaquatro', sexta: 'diacinco', sabado: 'diaseis' };

    // Apagar todas as imagens
    Object.values(nomesDias).forEach(nomeArquivo => {
      ['.jpg', '.png'].forEach(ext => {
        const caminho = path.join(__dirname, 'assets', `${nomeArquivo}${ext}`);
        if (fs.existsSync(caminho)) fs.unlinkSync(caminho);
      });
    });

    // Limpar o data.txt
    fs.writeFileSync(path.join(__dirname, 'data.txt'), '');

    res.send('Todos os anúncios foram apagados com sucesso.');
  } catch (error) {
    console.error('Erro em /apagar-todos-anuncios:', error);
    res.status(500).send('Erro interno no servidor');
  }
});



//teste
/*app.get('/testar-envio-agora', async (req, res) => {
  const dia = new Date().getDay(); // dia atual
  const hora = new Date().getHours(); // hora atual
  const nomeImagemBase = imagemMap[dia];
  const nomeMensagem = diaMap[dia];

  if (!nomeImagemBase || !nomeMensagem) {
    return res.send('❌ Dia inválido');
  }

  const mensagemMap = lerMensagensDataTxt();
  const texto = mensagemMap[nomeMensagem];
  if (!texto) return res.send('❌ Texto não encontrado no data.txt');

  const exts = ['.jpg', '.png'];
  let caminhoImagem = null;

  for (const ext of exts) {
    const tentativa = path.join(assetsDir, `${nomeImagemBase}${ext}`);
    if (fs.existsSync(tentativa)) {
      caminhoImagem = tentativa;
      break;
    }
  }

  if (!caminhoImagem) return res.send('❌ Imagem não encontrada');

  try {
    const media = MessageMedia.fromFilePath(caminhoImagem);
    const grupos = lerGruposDestinatarios();

    for (const grupoId of grupos) {
      await client.sendMessage(grupoId, media, { caption: texto });
      console.log(`✅ Mensagem de teste enviada para ${grupoId}`);
    }

    res.send('✅ Teste de envio manual concluído.');
  } catch (erro) {
    console.error('❌ Erro no envio de teste:', erro);
    res.send('❌ Erro ao enviar mensagem de teste');
  }
});
*/

app.listen(PORT, () => {
  console.log(`🟢 Servidor rodando em http://localhost:${PORT}/index.html`);
});

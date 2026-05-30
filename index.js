const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const MP_TOKEN = process.env.MP_ACCESS_TOKEN;

// ===== STORAGE (em memória, reseta se servidor reiniciar) =====
var lottery1 = { tickets: {}, lastDraw: '', winners: [] }; // check-in grátis
var lottery2 = { tickets: {}, lastDraw: '', winners: [] }; // comprado

// ===== HELPERS =====
function getTimeNow() {
  var now = new Date();
  // Ajusta para horário de Brasília (UTC-3)
  var brt = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  return {
    hours: brt.getHours(),
    minutes: brt.getMinutes(),
    dateStr: brt.toISOString().slice(0, 10),
    timeStr: brt.getHours() + ':' + String(brt.getMinutes()).padStart(2, '0')
  };
}

function doLotteryDraw(lottery, maxWinners, prize, lotteryName) {
  var allTickets = [];
  Object.keys(lottery.tickets).forEach(function(user) {
    lottery.tickets[user].forEach(function(num) {
      allTickets.push({ user: user, num: num });
    });
  });

  if (allTickets.length === 0) {
    console.log('[' + lotteryName + '] Nenhum bilhete, sorteio cancelado');
    return [];
  }

  // Embaralha
  for (var i = allTickets.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = allTickets[i]; allTickets[i] = allTickets[j]; allTickets[j] = temp;
  }

  // Seleciona ganhadores únicos (1 por usuário)
  var winners = [];
  var usedUsers = {};
  for (var k = 0; k < allTickets.length && winners.length < maxWinners; k++) {
    var t = allTickets[k];
    if (!usedUsers[t.user]) {
      usedUsers[t.user] = true;
      winners.push({ user: t.user, num: t.num, prize: prize });
    }
  }

  console.log('[' + lotteryName + '] Sorteio! ' + winners.length + ' ganhadores de ' + prize + ' moedas');
  return winners;
}

// ===== VERIFICAR SORTEIOS A CADA MINUTO =====
setInterval(function() {
  var t = getTimeNow();

  // Sorteio 1 — 12:30
  if (t.hours === 12 && t.minutes === 30 && lottery1.lastDraw !== t.dateStr) {
    lottery1.lastDraw = t.dateStr;
    lottery1.winners = doLotteryDraw(lottery1, 30, 150, 'SORTEIO-1');
    lottery1.tickets = {}; // Reseta bilhetes após sorteio
    console.log('Sorteio 1 realizado:', lottery1.winners.length, 'ganhadores');
  }

  // Sorteio 2 — 21:30
  if (t.hours === 21 && t.minutes === 30 && lottery2.lastDraw !== t.dateStr) {
    lottery2.lastDraw = t.dateStr;
    lottery2.winners = doLotteryDraw(lottery2, 30, 1500, 'SORTEIO-2');
    lottery2.tickets = {}; // Reseta após sorteio
    console.log('Sorteio 2 realizado:', lottery2.winners.length, 'ganhadores');
  }
}, 30000); // Verifica a cada 30 segundos

// ===== ROTAS =====

// Adicionar bilhete grátis (check-in)
app.post('/lottery1/add', function(req, res) {
  var user = req.body.user;
  if (!user) return res.status(400).json({ ok: false, erro: 'User required' });
  var t = getTimeNow();
  // Verifica se já tem bilhete hoje
  if (lottery1.tickets[user] && lottery1.tickets[user].date === t.dateStr) {
    return res.json({ ok: false, erro: 'Já tem bilhete hoje', num: lottery1.tickets[user].nums[0] });
  }
  var num = Math.floor(Math.random() * 900000) + 100000; // 6 dígitos
  if (!lottery1.tickets[user]) lottery1.tickets[user] = { nums: [], date: '' };
  lottery1.tickets[user] = { nums: [num], date: t.dateStr };
  console.log('[SORTEIO-1] Bilhete para', user, ':', num);
  res.json({ ok: true, num: num, nextDraw: '12:30' });
});

// Comprar bilhete (sorteio 2)
app.post('/lottery2/buy', function(req, res) {
  var user = req.body.user;
  var qty = parseInt(req.body.qty) || 1;
  if (!user) return res.status(400).json({ ok: false, erro: 'User required' });
  if (qty < 1 || qty > 5) return res.status(400).json({ ok: false, erro: 'Entre 1 e 5 bilhetes' });
  var t = getTimeNow();
  if (!lottery2.tickets[user]) lottery2.tickets[user] = { nums: [], date: t.dateStr };
  // Verifica limite de 5 por dia
  var existing = lottery2.tickets[user].date === t.dateStr ? lottery2.tickets[user].nums.length : 0;
  if (existing >= 5) return res.json({ ok: false, erro: 'Limite de 5 bilhetes por dia atingido' });
  var canBuy = Math.min(qty, 5 - existing);
  if (lottery2.tickets[user].date !== t.dateStr) { lottery2.tickets[user].nums = []; lottery2.tickets[user].date = t.dateStr; }
  var nums = [];
  for (var i = 0; i < canBuy; i++) {
    var num = Math.floor(Math.random() * 900000) + 100000;
    lottery2.tickets[user].nums.push(num);
    nums.push(num);
  }
  console.log('[SORTEIO-2] Bilhetes para', user, ':', nums);
  res.json({ ok: true, nums: nums, total: lottery2.tickets[user].nums.length, nextDraw: '21:30' });
});

// Status dos sorteios
app.get('/lottery/status', function(req, res) {
  var t = getTimeNow();
  res.json({
    ok: true,
    time: t.timeStr,
    lottery1: {
      participants: Object.keys(lottery1.tickets).length,
      lastDraw: lottery1.lastDraw,
      winners: lottery1.winners.slice(-30),
      nextDraw: '12:30'
    },
    lottery2: {
      participants: Object.keys(lottery2.tickets).length,
      lastDraw: lottery2.lastDraw,
      winners: lottery2.winners.slice(-30),
      nextDraw: '21:30'
    }
  });
});

// Verificar se usuário ganhou
app.get('/lottery/winners/:user', function(req, res) {
  var user = req.params.user;
  var w1 = lottery1.winners.find(function(w) { return w.user === user; });
  var w2 = lottery2.winners.find(function(w) { return w.user === user; });
  res.json({ ok: true, won1: w1 || null, won2: w2 || null });
});

// Pagar saque
app.post('/pagar-saque', async function(req, res) {
  try {
    var valor = parseFloat(req.body.valor);
    var chave_pix = req.body.chave_pix;
    var nome = req.body.nome;
    var email = req.body.email || 'user@777coin.site';
    if (!valor || !chave_pix) return res.status(400).json({ ok: false, erro: 'Dados incompletos' });
    var response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + MP_TOKEN },
      body: JSON.stringify({
        transaction_amount: valor,
        description: 'Saque 777 Coin - ' + nome,
        payment_method_id: 'pix',
        payer: { email: email, first_name: nome || 'Usuario' }
      })
    });
    var data = await response.json();
    if (data.id) { res.json({ ok: true, id: data.id, status: data.status }); }
    else { res.status(400).json({ ok: false, erro: data.message || 'Erro MP', data: data }); }
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

app.get('/', function(req, res) { res.json({ status: 'Servidor 777 Coin OK', time: getTimeNow().timeStr }); });

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log('Servidor rodando na porta', PORT); });

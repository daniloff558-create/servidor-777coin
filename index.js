const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const MP_TOKEN = process.env.MP_ACCESS_TOKEN;

app.post('/pagar-saque', async (req, res) => {
  try {
    const { valor, chave_pix, nome, email } = req.body;
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + MP_TOKEN
      },
      body: JSON.stringify({
        transaction_amount: parseFloat(valor),
        description: 'Saque 777 Coin',
        payment_method_id: 'pix',
        payer: { email: email || 'user@777coin.site' }
      })
    });
    const data = await response.json();
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'ok' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Rodando na porta', PORT));

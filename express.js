const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const mongoose = require('mongoose')
const { OpenAI } = require('openai');
const bodyParser = require('body-parser');
const path = require('path')

const accountSid = 'ACfef88ae0600c9adc53dd68c35a2cda54';
const authToken = 'fddfb25152803aaaac1ec03d46bbc180';
const client = require('twilio')(accountSid, authToken);
const { Server } = require('ws');
const { createServer } = require("http");

const app = express();
const httpServer = createServer(app);
// const { createServer } = require("http");
// Correct way to instantiate OpenAI client with the apiKey option
const openai = new OpenAI({
  apiKey: ""
});

// Rest of your server code...


const sockserver = new Server({ server: httpServer });
var socketClient;

sockserver.on('connection', ws => {
  socketClient = ws;
  console.log('New client connected!')
  // ws.send('connection established')
  ws.on('close', () => console.log('Client has disconnected!'))
  ws.on('message', data => {
    sockserver.clients.forEach(client => {
      console.log(`distributing message: ${data}`)
      client.send(`${data}`)
    })
  })
  ws.onerror = function () {
    console.log('websocket error')
  }
})
app.use(cors());

app.use(bodyParser.json())

app.use(express.urlencoded({ extended: true }))

// setting up socket


const server = require('http').createServer(app);
var globalSocket;
mongoose.connect('mongodb://localhost:27017/my-database', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

const messageSchema = new mongoose.Schema({
  whatsapp: {
    type: String,
    require: true
  },
  content: {
    type: String,
    require: true
  },
  type: {//send == true or receive
    type: Boolean,
    require: true,
    default: true
  }
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);



app.get('/api', (req, res) => {
  res.send('Server Running')
})
let name, phone, money;
app.post('/api/row-data', (req, res) => {
  // The row data is in req.body.rowData
  // const rowData = req.body.rowData;
  console.log(req.body.rowData)
  name = req.body.rowData[0];
  phone = Number(req.body.rowData[1]);
  money = req.body.rowData[3];
  // Process row data here as needed for your application
  res.status(200).json({ message: 'Row data received successfully!' })
});
assistant_msg = [];
user_msg = [];
messages = []

app.post('/api/send-sms', async (req, res) => {
  console.log('Hello to the Twilio Server')
  res.send('Hello to the Twilio Server');
  console.log('whatsapp:+14155238886')


  init_msg = `Hola, ${name}`
  socketClient.send(JSON.stringify({ type: false, content: init_msg }));
  assistant_msg.push(init_msg)
  const message = new Message({
    whatsapp: `whatsapp:+${phone}`.replace(/`/g, "'"),
    content: init_msg,
    type: false
  });
  await message.save();
  await client.messages
    .create({
      from: 'whatsapp:+14155238886',
      body: init_msg,
      to: `whatsapp:+${phone}`.replace(/`/g, "'")
    })
    .then(message => console.log(message));


})
if (socketClient) socketClient.send('req.body.Body');
app.post('/message', async (req, res) => {
  console.log('post message_____')
  if (socketClient.readyState) socketClient.send(JSON.stringify({ content: req.body.Body, type: true }));
  const { Body, From } = req.body;
  console.log(req.body.Body);
  user_msg.push(req.body.Body);
  const message = new Message({
    whatsapp: `whatsapp:+${phone}`.replace(/`/g, "'"),
    content: req.body.Body,
    type: true
  });
  await message.save();

  try {
    context = `Nombre : ${name}\nNúmero de teléfono : +${phone}\nFamily numbers : 4\nImporte de la deuda : ${money}\nValor del interés : 5% mensual\n Número de tarjeta de crédito : 6928 3452 2344 \nMeses vencidos : 5 meses\n Nombre del banco: Central Bank`


    messages.push({ "role": "system", "content": "Como asesor bancario, tu papel es pedir a los clientes que carguen la deuda al banco en español. La información del usuario es como el siguiente contexto." + context + "\nTe llamas Majo. plz summarize following conversation in 5 sentences" })

    for (let i = 0; i < assistant_msg.length; i++) {
      messages.push({ role: "assistant", content: assistant_msg[i] });
      messages.push({ role: "user", content: user_msg[i] });
    }
    gptResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,

    })


    const gptText = gptResponse.choices[0].message.content;
    socketClient.send(JSON.stringify({ type: false, content: gptText }));

    client.messages.create({
      from: 'whatsapp:+14155238886',
      body: gptText,
      to: `whatsapp:+${phone}`.replace(/`/g, "'")
    })
      .then(message => console.log(message))

    assistant_msg.push(gptText)

    const message = new Message({
      whatsapp: `whatsapp:+${phone}`.replace(/`/g, "'"),
      content: gptText,
      type: false
    });
    await message.save();

    res.status(200).json({ message: 'Message sent successfully.' })



  } catch (error) {
    console.error("An error occurred while fetching the GPT response:", error);
    throw error
  }

});

app.get('/api/messages', (req, res) => {
  const whatsapp = req.query.whatsapp;
  console.log('whatsapp__', req.query, whatsapp, `whatsapp:+${whatsapp}`.replace(/`/g, "'"))
  Message.find({ whatsapp: `whatsapp:+${whatsapp}`.replace(/`/g, "'") })
    .then((messages) => {
      console.log('messages____', messages)
      return res.status(200).send(messages)
    })
    .catch(err => console.log('this is error_____', err))
})
app.use(express.static("client"));
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "client", "index.html"));
});

httpServer.listen(4000, () => console.log("Running on Port 4000"));
// const ws_server = new Server({ app });

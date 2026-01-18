require('dotenv').config()
const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js')
const axios = require('axios')
const fs = require('fs')
const cron = require('node-cron')

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
})

const CHANNEL_ID = process.env.CHANNEL_ID

const STEAMDB_URL = "https://steamdb.info/calculator/76561199883458792/?json=1"

// ---------------- RUST SAAT ----------------

async function getRustHours() {

    const res = await axios.get(STEAMDB_URL, {
        headers: { "User-Agent": "Mozilla/5.0" }
    })

    const rust = res.data.games.find(g => g.appid === 252490)

    return rust.playtime_forever / 60
}

// ---------------- DATA ----------------

function loadData() {
    return JSON.parse(fs.readFileSync('stats.json'))
}

function saveData(data) {
    fs.writeFileSync('stats.json', JSON.stringify(data, null, 2))
}

// ---------------- 2 SAAT KONTROL ----------------

async function checkRust() {

    const data = loadData()
    const total = await getRustHours()

    if (data.lastTotal === 0) {
        data.lastTotal = total
        saveData(data)
        return
    }

    const diff = total - data.lastTotal

    if (diff > 0.1) {

        const channel = await client.channels.fetch(CHANNEL_ID)

        channel.send(
            `🦀 **Rust Oynandı!**\n+${diff.toFixed(2)} saat\nToplam: ${total.toFixed(1)} saat`
        )

        data.lastTotal = total
        saveData(data)
    }
}

// ---------------- GÜNLÜK KAYIT ----------------

function saveDaily() {

    const data = loadData()
    const today = new Date().toLocaleDateString("tr-TR")

    data.history.push({
        date: today,
        hours: data.lastTotal
    })

    if (data.history.length > 7) {
        data.history.shift()
    }

    saveData(data)
}

// ---------------- GRAFİK URL ----------------

function generateChartURL(type) {

    const data = loadData()
    const labels = data.history.map(x => x.date)

    if (type === "daily") {

        let daily = []

        for (let i = 1; i < data.history.length; i++) {
            daily.push(data.history[i].hours - data.history[i - 1].hours)
        }

        return `https://quickchart.io/chart?c={
          type:'bar',
          data:{labels:${JSON.stringify(labels.slice(1))},
          datasets:[{label:'Gunluk Rust Saat',data:${JSON.stringify(daily)}}]}
        }`
    }

    if (type === "total") {

        return `https://quickchart.io/chart?c={
          type:'line',
          data:{labels:${JSON.stringify(labels)},
          datasets:[{label:'Toplam Rust Saat',data:${JSON.stringify(data.history.map(x => x.hours))}}]}
        }`
    }
}

// ---------------- GECE 00:00 ----------------

cron.schedule('0 0 * * *', async () => {

    saveDaily()

    const channel = await client.channels.fetch(CHANNEL_ID)

    channel.send({
        content: '📊 **Rust 7 Gunluk Grafik Raporu**',
        embeds: [{
            title: "Gunluk Oynama",
            image: { url: generateChartURL("daily") }
        }, {
            title: "Toplam Saat",
            image: { url: generateChartURL("total") }
        }]
    })

}, { timezone: "Europe/Istanbul" })

// ---------------- SLASH COMMAND ----------------

client.once('ready', async () => {

    console.log('Bot aktif!')

    const cmd = new SlashCommandBuilder()
        .setName('grafik')
        .setDescription('Rust grafik raporu')

    await client.application.commands.create(cmd)

    checkRust()
    setInterval(checkRust, 2 * 60 * 60 * 1000)
})

client.on('interactionCreate', async interaction => {

    if (!interaction.isChatInputCommand()) return

    if (interaction.commandName === 'grafik') {

        interaction.reply({
            content: '📊 Rust Grafik:',
            embeds: [{
                title: "Gunluk Oynama",
                image: { url: generateChartURL("daily") }
            }, {
                title: "Toplam Saat",
                image: { url: generateChartURL("total") }
            }]
        })
    }
})

client.login(process.env.DISCORD_TOKEN)

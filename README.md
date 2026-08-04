<div align="center">

# Tehseen Tech Automation

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=28&pause=1000&color=9B59B6&center=true&vCenter=true&width=600&lines=Tehseen+Tech+Automation;Ultimate+WhatsApp+Bot;Fast+%7C+Powerful+%7C+Unstoppable" alt="Typing SVG" />

<br/>

[![License](https://img.shields.io/badge/LICENSE-MIT-9B59B6?style=for-the-badge&logo=opensourceinitiative&logoColor=white&labelColor=0D0D0D)](LICENSE)
[![Author](https://img.shields.io/badge/AUTHOR-TEHSEENTECH-8E44AD?style=for-the-badge&logo=github&logoColor=white&labelColor=0D0D0D)](https://github.com/tehseentech)

<br/>

> **Silent. Swift. Unstoppable. — The Tehseen Tech Automation WhatsApp Bot.**

</div>

---

## Features

<div align="center">

| AI Integration | Games | Group Tools | Downloaders |
|:---:|:---:|:---:|:---:|
| Smart chat bot | TicTacToe, Dice, WCG | Anti-link, Anti-spam | YouTube, TikTok, IG |

| Media | Security | Scheduler | Multi-lang |
|:---:|:---:|:---:|:---:|
| Stickers, Audio FX | View-once guard | Daily greetings | Translate support |

</div>

---

## Quick Setup

### 1. Get Your Session ID

Visit your bot's pairing page at `https://yourdomain.com/pair` or use the built-in **Pair Device** tab on the homepage.

### 2. Set Environment Variables

```env
SESSION_ID=your_session_id_here
MODE=public
OWNER_NAME=YourName
TIME_ZONE=Africa/Nairobi
```

---

## Deployment

### Heroku

Set environment variables in your Heroku app's Config Vars, then deploy.

### VPS

```bash
cd /opt/tehseen-bot
sudo bash deploy/setup-vps.sh
nano .env                        # add your SESSION_ID
systemctl start tehseen-bot
```

See `deploy/` folder for systemd service, nginx config, and full setup script.

---

## Tech Stack

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Baileys](https://img.shields.io/badge/Baileys-7.0.0-9B59B6?style=flat-square&logo=whatsapp&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=flat-square&logo=ffmpeg&logoColor=white)

</div>

---

## Configuration

| Variable | Description | Default |
|---|---|---|
| `SESSION_ID` | WhatsApp session token | **Required** |
| `MODE` | `public` or `private` | `public` |
| `OWNER_NAME` | Your display name | `TehseenTech` |
| `OWNER_NUMBER` | Your phone number | — |
| `TIME_ZONE` | Your timezone | `Africa/Nairobi` |
| `DATABASE_URL` | PostgreSQL URL (optional) | SQLite fallback |
| `EXPIRY_DATE` | Bot expiry `YYYY-MM-DD` | None |

---

<div align="center">

**Built by [TehseenTech](https://github.com/tehseentech)**

*Tehseen Tech Automation — silent, swift, unstoppable.*

</div>

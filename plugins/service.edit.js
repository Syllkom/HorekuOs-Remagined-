import fs from 'fs'
import path from 'path'

export default {
  command: true,
  usePrefix: true,
  case: ['edit', 'ed'],
  script: async (m, { sock }) => {
    const arg = (m.args[0] || '').toLowerCase()

    if (!['anime', 'phonk', 'retro'].includes(arg)) {
      return await m.reply(
        'Ejemplos de uso:\nSelecciona una opción\n/ed anime\n/ed retro\n/ed phonk'
      )
    }

    const editsAnimeDB = JSON.parse(
      fs.readFileSync(path.resolve('./source/database/animeEditsDB.json'))
    )

    const edits = arg === 'anime'
        ? editsAnimeDB.edits_anime
        : arg === 'phonk'
        ? editsAnimeDB.edit_phonk
        : arg === 'retro'
        ? editsAnimeDB.edits_retro
        : null

    if (!edits || edits.length === 0) {
      return m.reply(
        `Ejemplo: /${m.command[0]} <anime|phonk|retro>\n- /ed anime\n- /ed phonk\n- /ed retro`
      )
    }

    const randomEdit = edits[Math.floor(Math.random() * edits.length)]
    const randomMessage =
      arg === 'retro'
        ? sabiasQue.retro_msg[
            Math.floor(Math.random() * sabiasQue.retro_msg.length)
          ]
        : ''
    const message = `● *Edit seleccionado (${arg}):*\n\n${
      arg === 'retro' ? `🖤 ${randomMessage}` : ''
    }`

    try {
      await sock.sendMessage(
        m.chat.id,
        { video: { url: randomEdit }, caption: message },
        { quoted: m.message }
      )
    } catch (error) {
      console.error('Error al enviar el video:', error)
      await m.reply('Hubo un error enviando el video.')
    }
  }
}
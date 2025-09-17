import fs from 'fs'

export default {
    command: true,
    usePrefix: true,
    case: ['comandos', 'menu', 'help'],
    script: async (m, { sock } ) => {

        function timeString(seconds) {
            const d = Math.floor(seconds / (3600 * 24));
            const h = Math.floor((seconds % (3600 * 24)) / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            return `${d ? d + ':' : ''}${h ? h + ':' : ''}${m ? m + ':' : ''}${s}`;
        }

        await m.react('wait')
        
        const sabiasque = global.sabiasQue.vos_sabiasq[Math.floor(Math.random() * global.sabiasQue.vos_sabiasq.length)]

        const menu = `✦ *${global.nmbot} - Bot*
- Usuario: @${m.sender.number}
- Activo: \`${timeString(process.uptime())}\`
- Creador: *—Syll's*
 + ${settings.mainOwner}

*▢* \`\`\`¿Sabías qué?\`\`\` _${sabiasque}_
${readMore}
*☲ Menú de Comandos:*

╭ ✦ *</Main>*
╵/ping
╵/help
╰╶╴──────╶╴─╶╴◯

╭ ✦ *</Adm>*
╵/config
╵/kick
╵/tag
╰╶╴──────╶╴─╶╴◯

╭ ✦ *</Service>*
╵/play
╵/edit
╰╶╴──────╶╴─╶╴◯

╭ ✦ *</Games>*
╵/reg
╵/bal
╵/inventory
╵/claim
╵/perfil
╰╶╴──────╶╴─╶╴◯
`

        await sock.sendMessage(m.chat.id, {
            document: Buffer.alloc(5),
            fileName: 'Hola @' + m.sender.name,
            mimetype: 'image/jpeg',
            caption: menu,
            jpegThumbnail: await sock.resizePhoto({
                image: 'https://files.catbox.moe/myvcx5.jpg',
                scale: 140,
                result: 'base64'
            }),
            contextInfo: {
                mentionedJid: [m.sender.id],
                externalAdReply: {
                    title: '',
                    body: 'Powered by @ScLab',
                    thumbnail: global.imghelp,
                    renderLargerThumbnail: true,
                    mediaType: 1,
                }
            },
        }, { quoted: m['@message'] })

        await m.react('done')
    }
}

import yts from 'yt-search'

export default {
    command: true,
    usePrefix: true,
    case: ['play'],
    script: async (m, { sock }) => {

        if (m.text) {
            await m.react('wait')
            try {
                const videos = (await yts(m.text)).videos
                if (!(videos.length > 0)) {
                    await m.react('❗')
                    return m.reply(`Sin resultados`)
                }
                const { title, thumbnail, timestamp, ago, views, url, author } = videos[0];

                let texto = `● *${title}*\n`;
                texto += `- Publicado: ${ago}\n`;
                texto += `- Duración: \`${timestamp}\`\n`;
                texto += `- Vistas: \`${views}\`\n`;
                texto += `- Canal: ${author.name}\n\n`;
                texto += `_Responda enviando un mensaje diciendo *audio* o *video*, según lo que prefiera._\n${global.readMore}\n- Link: ${url}`;

                const sentMessage = await sock.sendMessage(m.chat.id, {
                    image: { url: thumbnail },
                    caption: texto,
                    fileName: 'thumbnail.jpeg',
                    mimetype: 'image/jpeg'
                }, { quoted: m.message });

                if (sentMessage) {
                    sock.saveMessageIdForResponse(sentMessage, {
                        user: 'all',
                        response: [{
                            condition: (m) => ['mp4', 'video'].some(o => m.body?.trim().toLowerCase() === o),
                            command: `.ytmp4 ${url}`
                        },
                        {
                            condition: (m) => ['mp3', 'audio'].some(o => m.body?.trim().toLowerCase() === o),
                            command: `.ytmp3 ${url}`
                        }]
                    });
                } else {
                     console.warn(`[WARN] No se recibió un objeto de mensaje de sock.sendMessage para guardar la respuesta.`);
                }
                
                await m.react('done');

            } catch (e) {
                await m.react('error');
                console.error(`[ERROR] Error en el comando play:`, e);
                m.reply('Ocurrió un error al procesar la solicitud.');
            }
        } else {
            m.reply(`Ingrese el comando *\`.${m.command}\`* y seguido el título de un video de *YouTube*`);
        }
    }
}

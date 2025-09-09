export default {
    command: true,
    usePrefix: true,
    case: ['yta', 'ytmp3'],
    script: async (m, { sock }) => {
        if (!m.text) {
            return m.reply(`Ingrese el comando *\`/${m.command}\`* seguido de un enlace de *YouTube*, ejemplo:\n/${m.command} https://youtube.com/watch?v=FZU8I9bPaTo`)
        }

        await m.react('wait')

        try {
            const YtDl = await sock.getJSON(`https://apis.davidcyriltech.my.id/download/ytmp3?url=${m.args[0]}`);

            if (!YtDl || !YtDl.result || !YtDl.result.download_url) {
                await m.react('❗');
                return m.reply('No se pudo obtener la información del audio. Verifique el enlace o inténtelo de nuevo.')
            }

            const YouTube = YtDl.result;

            await sock.sendMessage(m.chat.id, {
                audio: audioBuffer,
                mimetype: "audio/mpeg",
                fileName: `${YouTube.title}.mp3`,
                ptt: false
            }, { quoted: m.message });

            await m.react('done')

        } catch (e) {
            console.error(e);
            await m.react('error');
            m.reply('Ocurrió un error al procesar su solicitud. Inténtelo de nuevo más tarde.')
        }
    }
}

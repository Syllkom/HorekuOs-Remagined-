const plugin = {
    case: ['ytv', 'ytmp4'],
    usage: ['ytmp4 <enlace>'],
    category: ['dl'],
    command: true,
    usePrefix: true,
}

plugin.script = async (m, { sock }) => {
    if (!m.text) {
        return m.reply(`Ingrese el comando *\`/${m.command}\`* seguido de un enlace de *YouTube*, ejemplo:\n/${m.command} https://youtube.com/watch?v=FZU8I9bPaTo`);
    }

    await m.react('wait')

    try {
        const YtDl = await sock.getJSON(`https://apis.davidcyriltech.my.id/download/ytmp4?url=${m.args[0]}`);
        
        if (!YtDl || !YtDl.result || !YtDl.result.download_url) {
            await m.react('❗');
            return m.reply('No se pudo obtener información del video. Verifique el enlace proporcionado.');
        }

        const YouTube = YtDl.result;
        
        m.reply(`Descargando video "${YouTube.title}"...`);
        const videoBuffer = await sock.getFrom(YouTube.download_url);

        if (!videoBuffer) {
            await m.react('❗');
            return m.reply('Error al descargar el video desde la URL proporcionada.');
        }

        const caption = `_Para descargar el audio, responde este mensaje con *audio* o *mp3*_\n${global.readMore}\n${YouTube.title}`;

        const sentMessage = await sock.sendMessage(m.chat.id, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            caption: caption,
            fileName: `${YouTube.title}.mp4`
        }, { quoted: m.message });
        
        if (sentMessage) {
            sock.saveMessageIdForResponse(sentMessage, {
                user: 'all',
                response: [{
                  condition: (m) => ['mp3', 'audio'].some(o => m.body?.trim().toLowerCase() === o),
                  command: `.ytmp3 ${m.args[0]}`
                }]
            });
        }

        await m.react('done');

    } catch (e) {
        console.error(e);
        await m.react('error');
        m.reply('Ocurrió un error al procesar su solicitud. Inténtelo de nuevo más tarde.');
    }
}

export default plugin;

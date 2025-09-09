export default {
    command: true,
    usePrefix: true,
    case: ['setpp', 'setpphoto', 'setpf', 'setpfoto'],
    script: async (m, { sock }) => {
        try {
            const isImage = m.message.message === 'imageMessage';
            const isQuotedImage = m.quoted.message && m.message.message === 'imageMessage';

            if (!isImage && !isQuotedImage) {
                return m.reply('Para usar el comando, envía una imagen o responde a una con el comando.');
            }

            await m.react('wait');
            
            const imageBuffer = await (isQuotedImage ? m.quoted.download() : m.download());
            
            const target = m.args[0]?.toLowerCase();

            if (target === 'bot' || target === 'b') {
                if (!m.sender.rowner) {
                    return m.reply('Este comando solo puede ser utilizado por el dueño.');
                }
                
                await sock.updateProfilePicture(m.bot.id, imageBuffer);
                await m.react('done');
            
            } else {
                if (!m.chat.group) {
                    return m.reply('Este comando solo se puede usar en grupos.');
                }
                if (!m.sender.admin) {
                    return m.reply('Este comando solo puede ser usado por los administradores del grupo.');
                }
                
                await sock.groupUpdateProfilePicture(m.chat.id, imageBuffer);
                await m.react('done');
            }

            await m.react('done');

        } catch (e) {
            console.error(e);
            await m.react('error');
            m.reply('Ocurrió un error al intentar cambiar la foto de perfil.');
        }
    }
}

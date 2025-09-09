import FormData from "form-data";
import got from "got";

export default {
    command: true,
    usePrefix: true,
    case: ['remini', 'hd'],
    script: async (m, { sock }) => {

        async function processImage(imageBuffer, method = "enhance") {
            const form = new FormData();
            const scheme = `https://inferenceengine.vyro.ai/${method}`;

            form.append("image", imageBuffer, "enhance_image_body.jpg");
            form.append("model_version", 1);

            const { body } = await got.post(scheme, {
                body: form,
                responseType: 'buffer',
                headers: {
                    ...form.getHeaders(),
                    "User-Agent": "okhttp/4.9.3",
                },
            });

            return body;
        }

        try {
            const quotedMsg = m.quoted?.message.message;
            const currentMsg = m.message.message;
            
            let imageBuffer;
            let targetMessage = m.message;

            if (quotedMsg && m.type(quotedMsg) === 'imageMessage') {
                await m.react('wait');
                m.reply('Mejorando la calidad de la imagen, por favor espera...');
                imageBuffer = await m.quoted.download();
                targetMessage = m.quoted.message;
            } else if (currentMsg && m.type(currentMsg) === 'imageMessage') {
                await m.react('wait');
                m.reply('Mejorando la calidad de la imagen, por favor espera...');
                imageBuffer = await m.download();
            } else {
                return m.reply('Por favor, envía una imagen con el comando o responde a una imagen con `.hd`.');
            }

            const enhancedImage = await processImage(imageBuffer, "enhance");

            await sock.sendMessage(m.chat.id, { 
                image: enhancedImage,
                caption: ``
            }, { quoted: targetMessage });

            await m.react('done');

        } catch (error) {
            console.error("Error en el comando Remini:", error);
            await m.react('error');
            m.reply('❌ Ocurrió un error al procesar la imagen. La API podría estar caída.');
        }
    }
}

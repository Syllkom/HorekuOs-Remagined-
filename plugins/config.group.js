import $base from '../library/fun.makeDBase.js';

const aliasMap = {
  welcome: ['welcome'],
  bye: ['bye'],
  notify: ['notify'],
  antilink: ['antilink'],
  antilink_wa_group: ['wa', 'grupo', 'group', 'wa_group'],
  antilink_channel: ['channel', 'canal'],
  antilink_ig: ['ig', 'instagram'],
  antilink_fb: ['fb', 'facebook'],
  antilink_x: ['x', 'twitter'],
  antilink_threads: ['threads'],
  antilink_tg: ['tg', 'telegram'],
  antilink_any: ['any', 'cualquiera', 'enlaces', 'links']
};

const resolveOption = (input) => {
  input = (input || '').toLowerCase();
  for (const key in aliasMap) {
    if (aliasMap[key].includes(input)) return key;
  }
  return null;
};

const options = Object.keys(aliasMap);

export default {
  command: true,
  case: ['config', 'settings', 'configgroup', 'groupconfig', 'antilink'],
  usePrefix: true,
  admin: true,
  group: true,
  script: async (m) => {
    const args = m.args.map(a => a?.toLowerCase()).filter(Boolean);
    const db = await $base.open('system:BUC');
    db.data['@chats'] = db.data['@chats'] || {};
    db.data['@chats'][m.chat.id] = db.data['@chats'][m.chat.id] || {};
    const chatConfig = db.data['@chats'][m.chat.id];

    if (!args.length) {
      let list = options.map(opt =>
        `- ${opt.replace('antilink_', 'antilink ')}: ${chatConfig[opt] ? '(on)' : '(off)'}`
      ).join('\n');
      return m.reply(
        `● *Configuración actual de funciones del grupo:*\n\n${list}\n\nEjemplo:\n.antilink fb on\n.config welcome off`
      );
    }

    let [feature1, feature2, value] = args;
    let feature = feature1;
    if (feature1 === 'antilink' && feature2) feature = 'antilink_' + feature2;
    if (!value && feature2 && ['on', 'off'].includes(feature2)) value = feature2;

    const key = resolveOption(feature);
    if (!key || !['on', 'off'].includes(value)) {
      let opts = [];
      for (const [k, v] of Object.entries(aliasMap)) {
        opts.push(`${k} (${v.join(', ')})`);
      }
      return m.reply(
        `Uso:\n.antilink <tipo> <on/off>\nTipos: ${opts.join(' | ')}\n\nEjemplo: .antilink fb on`
      );
    }

    chatConfig[key] = value === 'on';
    await db.update();

    return m.reply(
      `La función *${key.replace('antilink_', 'Antilink ')}* se ha ${value === 'on' ? 'activado' : 'desactivado'} correctamente.\n\nEscribe *.config* para ver el estado actual.`
    );
  }
}
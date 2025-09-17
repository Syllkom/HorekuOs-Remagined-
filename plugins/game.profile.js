import datagame from '../source/datagame.js';

export default {
  command: true,
  case: ['perfil', 'profile', 'rpgperfil', 'rpgprofile'],
  usePrefix: true,
  script: async (m) => {
    const jid = m.sender.id || m.sender;
    const user = datagame.getUser(jid);

    const titles = user.titles && user.titles.length ? user.titles.join(', ') : 'Ninguno';

    const inventory = user.inventory && user.inventory.length
      ? user.inventory.map(item => `- ${item}`).join('\n')
      : 'Vacío';

    const stats = user.stats || { battles: 0, wins: 0, losses: 0 };
    const winrate = stats.battles > 0
      ? ((stats.wins / stats.battles) * 100).toFixed(1) + '%'
      : '0%';

    const regStatus = user.registered
      ? `✅ Registrado\n📅 Desde: ${user.registration_date ? new Date(user.registration_date).toLocaleDateString() : "?"}`
      : '❌ No registrado';

    const profile = [
      `👤 Perfil RPG de @${jid.split('@')[0]}`,
      '─────────────',
      regStatus,
      `\n🏅 Títulos: ${titles}`,
      `\n🔝 Nivel: ${user.level} (${user.xp}/${user.xp_limit} XP)`,
      `🏆 Rango: ${user.rank}`,
      `💰 Monedas: ${user.coins}`,
      `💎 Gemas: ${user.gems}`,
      `\n🗃️ Inventario:\n${inventory}`,
      `\n📈 Estadísticas:`,
      `• Batallas: ${stats.battles}`,
      `• Victorias: ${stats.wins}`,
      `• Derrotas: ${stats.losses}`,
      `• Winrate: ${winrate}`,
    ].join('\n');

    m.reply(profile, null, { mentions: [jid] });
  }
}
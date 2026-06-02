require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'timixa_dev_secret',
  VAPID_PUBLIC_KEY:
    process.env.VAPID_PUBLIC_KEY ||
    'BHt0g_cNMtfx5nbQDr2di9Sy-8efiFdlbNpAmkFD_uQmhMTKyZngcA1EL4qCxdPzVO3J63QJb4P0HAH_SY5ISqQ',
  VAPID_PRIVATE_KEY:
    process.env.VAPID_PRIVATE_KEY ||
    '_csMpnpn__HTcZiQuQNbmo8uffnmkgpcoCV_kJG5Dos',
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:demo@timixa.com',
};

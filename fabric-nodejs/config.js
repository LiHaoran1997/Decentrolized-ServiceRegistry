var util = require('util');
var path = require('path');
var hfc = require('fabric-client');

var file = 'network-config%s.yaml';

var env = process.env.TARGET_NETWORK;
if (env)
	file = util.format(file, '-' + env);
else
	file = util.format(file, '');
// indicate to the application where the setup file is located so it able
// to have the hfc load it to initalize the fabric client instance
hfc.setConfigSetting('network-connection-profile-path',path.join(__dirname, 'artifacts' ,file));
hfc.setConfigSetting('Gfe-connection-profile-path',path.join(__dirname, 'artifacts', 'gfe.yaml'));
hfc.setConfigSetting('Deke-connection-profile-path',path.join(__dirname, 'artifacts', 'deke.yaml'));
hfc.setConfigSetting('strategy-connection-profile-path',path.join(__dirname, 'strategy'));
// some other settings the application might need to know
hfc.addConfigFile(path.join(__dirname, 'config.json'));

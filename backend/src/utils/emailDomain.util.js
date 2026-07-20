const env = require("../config/env");

const isEmployeeDomainEmail = (email) => email.toLowerCase().endsWith(`@${env.EMPLOYEE_EMAIL_DOMAIN}`);

module.exports = { isEmployeeDomainEmail };

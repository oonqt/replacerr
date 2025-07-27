class Logger {
    constructor() {}
    
    info(...msg) {
        console.info(new Date().toISOString(), 'INFO:', ...msg);  
    }
    
    error(...msg) {
        console.error(new Date().toISOString(), 'ERROR:', ...msg);
    }
}

module.exports = Logger;
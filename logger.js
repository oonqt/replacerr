class Logger {
    constructor(debug) {
        this.debugEnabled = debug;
    }
    
    info(...msg) {
        console.info(new Date().toISOString(), 'INFO:', ...msg);  
    }
    
    error(...msg) {
        console.error(new Date().toISOString(), 'ERROR:', ...msg);
    }
    
    debug(...msg) {
        if (this.debugEnabled) console.debug(new Date().toISOString(), 'DEBUG:', ...msg);
    }
}

module.exports = Logger;
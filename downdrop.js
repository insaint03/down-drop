(()=> {
    let conditional_worker = {
        // 
        'mozilla': (opts) => {
            return opts;
        },
        // 
        'baemins': (opts)=>{
            return opts;
        },

        'coupeats': (opts) => {
            return opts;
        },

        'unos': (opts) => {
            return opts;
        },
    }

    window.__downdrop = function(options) {
        Object
            .keys(conditional_worker)
            .forEach((hostkey)=>{
                if(location.hostname.includes(hostkey)) {
                    let rs = conditional_worker[hostkey](options);
                    window.console.log(rs);
                }
            });
    };
})();

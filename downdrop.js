(()=> {
    let promised_get = (url, params) => {
        return new Promise((rs, rj) => {
            let xhr = new XMLHttpRequest();
            xhr.addEventListener('load', rs);
            xhr.addEventListener('error', rj);
            prs = Object.keys(params).map((k)=>`${k}=${encodeURIComponent(params[k])}`);
            xhr.open('GET', `${url}?${prs.join('&')}`);
            xhr.send();
        });
    };

    let filedownload = () => {

    };

    let conditional_worker = {
        // 
        'mozilla': (opts) => {
            return opts;
        },
        // 
        'ceo.baemin.com': async (opts) => {
            const endpoint = '/v1/orders';
            const interval = 3600*24*1e3 * 6;
            const params = {
                sort: 'ORDER_DATETIME',
                shopNo: '',
                adInventoryKey: '',
                purchaseType: '',
                orderStatus: 'CLOSED',
                startDate: opts.start_date,
                endDate: opts.end_date,
                offset: 0,
                limit: 50,
            };

            let ts_cursor = new Date(opts.start_date).getTime();
            let ts_threshold = new Date(opts.end_date).getTime();
            let rss = [];
            while((ts_cursor+interval) <= ts_threshold) {
                let rs = [];
                let date_starts = (new Date(ts_cursor)).toISOString().split('T')[0];
                let date_ends = (new Date(ts_cursor + interval)).toISOString().split('T')[0];
                await promised_get(`${endpoint}`, Object.assign(params, {
                    __ts: Date.now(),
                    startDate: date_starts,
                    endDate: date_ends,
                    offset: rs.length,
                })).then((resp)=>{
                    let data = JSON.parse(resp.currentTarget.responseText).data;
                    window.console.log(date_starts, rs.length, data);
                    rs = rs.concat(data.histories);
                    if(rs.length>=data.totalCount) {
                        ts_cursor += interval;
                        rss = rss.concat(rs);
                        rs = [];
                    }
                });
            }
            
            

            return rss.reduce((gs, order)=>{
                return gs.concat(order.items.map((item)=>[
                    // 구분
                    order.serviceType,
                    // 주문번호
                    order.orderNo,
                    // 날짜/시각
                    order.orderDatetime,
                    // 점포
                    order.shop.name,
                    // 상품
                    item.name,
                    // 수량
                    item.quantity,
                    // 주문총액
                    order.orderAmount,
                    // 주문 결과
                    order.status,
                ]));
            }, []);
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

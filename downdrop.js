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

    let filedownload = (filename, contents) => {

    };

    let conditional_worker = {
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
            let rs = [];

            while(ts_cursor <= ts_threshold) {
                let date_starts = (new Date(ts_cursor)).toISOString().split('T')[0];
                let date_ends = (new Date(Math.min(ts_threshold, ts_cursor + interval))).toISOString().split('T')[0];
                let resp = await promised_get(`${endpoint}`, Object.assign(params, {
                    __ts: Date.now(),
                    startDate: date_starts,
                    endDate: date_ends,
                    offset: rs.length,
                }))

                let data = JSON.parse(resp.currentTarget.responseText).data;
                window.console.log(date_starts, rs.length, data);
                rs = rs.concat(data.histories);
                if(rs.length>=data.totalCount) {
                    ts_cursor += interval;
                    rss = rss.concat(rs);
                    rs = [];
                }
            }
            
            let rets = [];
            for(let i=0; i<rss.length; i++) {
                let order = rss[i];
                let details = await promised_get(`${endpoint}/${order.orderNo}`, { __ts: Date.now() });
                let detailInfo = JSON.parse(details.currentTarget.responseText).data;
                rets = rets.concat(detailInfo.items.map((item)=>[
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
                    // 단가
                    item.price,
                    // 할인
                    item.discount,
                    // 주문총액
                    order.orderAmount,
                ]));
            }
            window.console.log(rets);
            return rets;
        },

        'store.coupangeats.com': async (opts) => {
            const endpoint = '/api/v1/merchant/web';
            let store_list = ()=> {
                return new Promise((rs,rj) => {
                $.ajax({method: 'GET', url: `${endpoint}/stores`, dataType: 'json',  
                    success: (resp) => { rs(resp.data); },
                    error: rj,
                });
            })};
            let order_list = (store_id, date_start, date_ends, page)=> {
                return new Promise((rs, rj) => {
                $.ajax({method: 'POST', url: `${endpoint}/order/condition`, dataType: 'json',
                    headers: {'content-type': 'application/json;charset=UTF-8'},
                    data: JSON.stringify({
                        storeId: store_id,
                        startDate: new Date(`${date_start}T00:00:00`).getTime(),
                        endDate: new Date(`${date_ends}T00:00:00`).getTime()-1,
                        pageNumber: page || 0,
                        pageSize: 50,
                    }),
                    success: (resp) => { rs(resp.orderPageVo); },
                    error: rj,
                });
            })}

            // load store list first
            let stores = await store_list();
            stores = stores.filter((store) => 
                opts.branches.reduce((filtered, branch) => {
                    return filtered || store.name.replace(/\w/g, '').includes(branch);
                }, false));

            let rets = [];
            for(let i=0; i<stores.length; i++) {
                let store = stores[i];
                window.console.log('run store', store.id, store.name);
                let rs = [];
                let totals = 0;
                let page = 0;
                do {
                    let resp = await order_list(store.id, opts.start_date, opts.end_date, page);
                    rs = rs.concat(resp.content.reduce((row, order)=> {
                        let items = order.items;
                        if(order.canceledItems) {
                            let filters = order.canceledItems.map((ci)=>ci.orderItemId);
                            items = items.filter((item)=>!filters.includes(item.orderItemId))
                        }
                        return row.concat(items.map((item)=>[
                            'CoupangEats',
                            order.abbrOrderId,
                            new Date(order.createdAt).toISOString().replace(/[TZ]/g, ' ').trim(),
                            store.name,
                            item.name,
                            item.quantity,
                            item.unitSalePrice,
                            0,
                            order.actuallyAmount,
                        ]));
                    }, []));
                    totals = resp.totalElements;
                    page += 1;
                } while(rs.length < totals);
                rets = rets.concat(rs);
            }

            window.console.log(rets);
            return rets;
        },

        'unospay.com': async (opts) => {
            const endpoint = '/php/db_query_menu.php';
            let stores = [];
            document.querySelectorAll('select#affiliate_id option[value]').forEach((store, si) => {
                if(si<=0) return;
                let store_id = store.value;
                let store_name = store.textContent.trim();
                if(opts.branches.reduce((filter, branch)=> {
                    return filter || store_name.replace(/\w/g, '').includes(branch);
                }, false)) {
                    stores.push({id: store_id, name: store_name });
                }
            });
            let order_list = (store_id, date_start, date_ends) => {
                return new Promise((rs, rj) => {
                    let ds = new Date(date_start).split(/[^\d]/);
                    let de = new Date(date_ends).split(/[^\d]/);

                    $.ajax({ method: 'POST', url: endpoint, dataType: 'json',
                        data: JSON.stringify({
                            start_year: ds[0],
                            start_month: ds[1],
                            start_date: ds[2],
                            end_year: de[0],
                            end_month: de[1],
                            end_date: de[2],
                            affiliate_id: store_id,
                        }),
                        success: (resp) => { rs(resp); },
                        error: rj,
                    })
                })
            }

            let rets = [];
            for(let i=0; i<stores.length; i++) {
                let store = stores[i];
                window.console.log('run store', store.id, store.name);
                let rss = await order_list(store.id, opts.start_date, opts.end_date);
                rets.concat(rss
                    .filter((row)=>0<(row[0]+row[1]+row[2]+row[4]).length)
                    .map((row)=>[
                    //구분
                    'Unospay',
                    // 
                    row[4],
                    row[0],
                    row[1],
                    row[2],
                    row[3],
                ]))
            }
            window.console.log(rets);
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

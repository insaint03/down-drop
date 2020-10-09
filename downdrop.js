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

  let filedownload = (opts, contents, columns) => {
    let alink = Object.assign(document.createElement('a'), {
      href: `data:text/plain;charset=utf-8,${[columns].concat(contents).map((row)=>row.join('\t')).join('\n')}`,
      download: `${location.hostname}_${opts.start_date}-${opts.end_date}.${(new Date()).toISOString()}.txt`,
    });
    document.body.appendChild(alink).click();
    alink.addEventListener('click', ()=>{ document.removeChild(alink); });
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

        let tz_offset = 9*3600*1e3; // GMT + 0900hrs

        let ts_cursor = new Date(opts.start_date).getTime()-1 +tz_offset;
        let ts_threshold = new Date(opts.end_date).getTime() +tz_offset;
        let rss = [];
        let rs = [];

        while(ts_cursor < ts_threshold) {
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
          detailInfo.items.map((item)=>{
            let order_info = [
              order.serviceType,
              order.orderNo,
              order.orderDatetime,
              order.shop.name,
            ];
            rets.push(order_info.concat([item.name, '', item.quantity, item.price, item.discount, order.orderAmount]));
            let opts = item.options.filter((opt)=>opt.group!='가격');
            if(opts && 0<opts.length) {
              opts.forEach((opt)=>{
                opt.items.forEach((o)=>{
                  rets.push(order_info.concat([item.name, o.name, o.quantity, o.price, o.discount, order.orderAmount]));
                })
              });
            }
          });
          // console log
          if((i+1)%20==0) {
            window.console.log(`${i+1}/${rss.length} done, `, order);
          }
        }
        // window.console.log(rets);
        filedownload(opts, rets, ['구분','주문번호','주문시각','점포명','상품명','옵션','수량','단가','할인','주문총액'])
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
                endDate: new Date(`${date_ends}T00:00:00`).getTime(),
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
              let counts = 0;
              let totals = 0;
              let page = 0;
              do {
                  let resp = await order_list(store.id, opts.start_date, opts.end_date, page);
                  counts += resp.content.length;
                  totals = Math.max(totals, resp.totalElements);
                  rs = rs.concat(resp.content.reduce((row, order)=> {
                      let items = order.items;
                      if(order.canceledItems) {
                          let filters = order.canceledItems.map((ci)=>ci.orderItemId);
                          items = items.filter((item)=>!filters.includes(item.orderItemId))
                      }
                      items.forEach((item)=>{
                        let order_row = [
                          'CoupangEats',
                          order.abbrOrderId,
                          new Date(order.createdAt).toISOString().replace(/[TZ]/g, ' ').trim(),
                          store.name,
                        ];
                        row.push(order_row.concat([item.name,'',item.quantity,item.unitSalePrice,0,order.salePrice]));
                        if(item.itemOptions && 0<item.itemOptions.length) {
                          item.itemOptions
                            .filter((opt)=>opt.optionName && opt.optionName.replace(/\s/g, '')!='변경안함')
                            .forEach((opt)=>{
                              row.push(order_row.concat([item.name,opt.optionName,opt.optionQuantity,opt.optionPrice,0,order.salePrice]));
                            });
                        }
                      })
                      return row;
                  }, []));
                  page += 1;
              } while(counts < totals);
              rets = rets.concat(rs);
          }

          // window.console.log(rets);
          filedownload(opts, rets, ['구분','주문번호','주문시각','점포명','상품명','옵션','수량','단가','할인','주문총액'])
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
                  let ds = date_start.split(/[^\d]/);
                  let de = date_ends.split(/[^\d]/);

                  $.ajax({ method: 'POST', url: endpoint, dataType: 'json',
                      data: $.param({
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
              let category = '';
              let menu = '';

              rss.forEach((row)=>{
                  if((row[0]+row[1]+row[2]+row[4]).length<=0) return;

                  category = row[4] || category;
                  menu = row[0] || menu;
                  option = row[1]
                  qty = row[2];
                  sum = row[3];
                  rets.push([
                      'Unospay',
                      store.name,
                      category,
                      menu,
                      option,
                      qty,
                      sum,
                  ]);
              });
          }
          window.console.log(rets);

          filedownload(opts, rets, ['구분','점포명','분류','메뉴 이름','옵션 이름','개수','합산 금액']);
          return rets;
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

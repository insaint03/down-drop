# down-y-drops

F12 콘솔 >> 아래 내용 복사 >> Enter 실행

```javascript

((d,o,w,n)=>{
    d.body.appendChild(o.assign(d.createElement('script'), {
        src: 'https://insaint03.github.io/down-drop/downdrop.js',
        async: true,
    })).addEventListener('load', ()=> {
        window.__downdrop(n);
    })
})(document, Object, window, {
    // 지점 선택
    branches: [
        '강남본점',
        '강남역점',
        '강남우성점',
    ],
    // 날짜 선택
    start_date: '2020-08-01',
    end_date: '2020-08-31',
});

```

- 열구분
    - 구분
    - 주문번호
    - 날짜/시각
    - 점포
    - 상품
    - 수량
    - 단가
    - 할인
    - 주문총액
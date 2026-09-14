const fs = require('fs');
fetch('https://streamx.frontmk.online/api/storage/v1/buckets/ff8983b2-b94b-4b5e-8e49-0653905ee563/objects', {
    method: 'POST',
    headers: { 'X-API-Key': 'mk_ca27b27d3b372836763b1ba744a3d9a8c8045fba73c0bc83' },
    body: (() => {
        const FormData = require('form-data');
        const fd = new FormData();
        fd.append('file', Buffer.from('test'), { filename: 'test.txt' });
        return fd;
    })()
}).then(res => res.json()).then(console.log).catch(console.error);

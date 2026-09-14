const fd = new FormData();
fd.append('file', new Blob(['test']), 'test.txt');

const res = await fetch('https://streamx.frontmk.online/api/storage/v1/buckets/ff8983b2-b94b-4b5e-8e49-0653905ee563/objects', {
    method: 'POST',
    headers: { 'X-API-Key': 'mk_ca27b27d3b372836763b1ba744a3d9a8c8045fba73c0bc83' },
    body: fd
});
const data = await res.json();
console.log(JSON.stringify(data, null, 2));

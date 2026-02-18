async function checkApi() {
    try {
        const res = await fetch('http://localhost:5000/api/verification/fee');
        const data = await res.json();
        console.log('API Response:', data);
    } catch (err) {
        console.error('API Error:', err.message);
    }
}

checkApi();

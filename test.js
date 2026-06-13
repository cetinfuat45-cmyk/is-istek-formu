fetch("https://script.google.com/macros/s/AKfycbx0TxZ8yjyP7v3q3tYqMxKs7stPL7g7AvhLRxOfm3Ovci0QGD8vM_IwhkmXBc0wu5BZ/exec", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify([{
        "createdAt": "TEST",
        "userName": "TEST",
        "costCenter": "TEST",
        "machine": "TEST",
        "shift": "TEST",
        "jobType": "TEST",
        "description": "TEST",
        "photoUrl": "TEST"
    }])
}).then(r => r.text()).then(t => console.log(t)).catch(e => console.error(e));

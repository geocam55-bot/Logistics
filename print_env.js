console.log(Object.keys(process.env).filter(k => k.toLowerCase().includes('map') || k.toLowerCase().includes('key') || k.toLowerCase().includes('secret') || k.toLowerCase().includes('google')));

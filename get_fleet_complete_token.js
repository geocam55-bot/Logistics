const username = "george.campbell@ronaatlantic.ca";
const password = "Trustnoone1!";
fetch("https://api.fleetcomplete.com/login/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "password", username, password })
}).then(res => res.json()).then(data => console.log(data.access_token)).catch(console.error);

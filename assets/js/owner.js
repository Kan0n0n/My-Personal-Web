'use strict';
const form = document.getElementById('owner-login');
const status = document.getElementById('owner-status');
const submit = form.querySelector('[type="submit"]');
async function ownerRequest(path, body) {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET', credentials: 'same-origin',
    ...(body ? {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {})
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Could not open your notebook.');
  return data;
}
form.onsubmit = async event => {
  event.preventDefault();
  submit.disabled = true;
  try {
    await ownerRequest('/api/auth/login', Object.fromEntries(new FormData(form)));
    location.replace('index.html');
  } catch (error) { status.textContent = error.message; submit.disabled = false; }
};
(async () => {
  try {
    const session = await ownerRequest('/api/auth/session');
    if (session.authenticated) { location.replace('index.html'); return; }
    status.textContent = 'Use your owner login. This browser will remember your session.';
    form.hidden = false;
  } catch (error) { status.textContent = error.message + ' Reload after the server is available.'; }
})();

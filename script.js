const finder = document.getElementById('finderForm');

function start(){ document.getElementById('finder').scrollIntoView({behavior:'smooth'}); }

function selectCategory(name){
  document.getElementById('category').value = name;
  start();
}

finder.addEventListener('submit', e=>{
  e.preventDefault();
  const data = {
    category: document.getElementById('category').value,
    budget: document.getElementById('budget').value,
    uses: document.getElementById('uses').value,
    priorities: document.getElementById('priorities').value,
    preferences: document.getElementById('preferences').value
  };
  const result = document.getElementById('result');
  result.classList.remove('hidden');
  result.innerHTML = `
    <h3>✨ Your OPITECH profile is ready</h3>
    <p><b>${data.category}</b> • Budget up to <b>₹${Number(data.budget).toLocaleString('en-IN')}</b></p>
    <p><b>Main uses:</b> ${escapeHTML(data.uses)}</p>
    <p><b>Top priorities:</b> ${escapeHTML(data.priorities)}</p>
    <p><b>Preferences:</b> ${escapeHTML(data.preferences || 'No extra preferences')}</p>
    <p style="color:#b34b00"><b>Next step:</b> Connect this form to your backend recommendation engine/API to return real products and live prices.</p>`;
  result.scrollIntoView({behavior:'smooth',block:'center'});
});

function escapeHTML(str){
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

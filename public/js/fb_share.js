/* eslint-disable no-undef */
document.getElementById('fbShareBtn').onclick = function() {    
    FB.ui({
      display: 'popup',
      method: 'share',
      quote: 'Lets play a game of Rent Day',
      href: window.location.href,
    }, function(response){});
  };
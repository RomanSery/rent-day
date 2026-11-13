/* eslint-disable no-undef */
document.getElementById('fb-share-button').onclick = function() {    
    FB.ui({
      display: 'popup',
      method: 'share',
      quote: "Think you can be a Block Baron? Let's play!",
      href: window.location.href,
    }, function(response){});
  };
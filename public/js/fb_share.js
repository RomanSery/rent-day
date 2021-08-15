/* eslint-disable no-undef */
document.getElementById('fb-share-button').onclick = function() {    
    FB.ui({
      display: 'popup',
      method: 'share',
      quote: 'Are you a fat cat? Lets play',
      href: window.location.href,
    }, function(response){});
  };
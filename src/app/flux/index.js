import {EventEmitter} from 'events';
import RoutePattern from 'route-pattern';
import find from 'lodash/collection/find';
import mapValues from 'lodash/object/mapValues';
import camelCase from 'lodash/string/camelCase';

import {Modernizr} from '../../server/adaptors/env';
import window from '../../server/adaptors/window';

import virtualUrl from './virtualurl';
import Routes from './routes';
import Actions from './actions';

const globalLoads = [{
  namespace: 'ustwo/v1/',
  type: 'studios'
}, {
  namespace: 'ustwo/v1/',
  type: 'footer'
}];

function emitify(fn) {
  console.log('setting up emitify 1');
  return function() {
    console.log('calling emitified fn', fn.toString(), arguments);
    return fn.apply(null, arguments).then(state => {
      console.log('about to emit', state);
      Flux.emit('change', state);
      return Promise.resolve(state);
    });
  };
}

function getRouteHandler(name, itemsToLoad, statusCode) {
  return Promise.all([
    Flux.goTo(name, statusCode || 200),
    Flux.loadData([].concat(globalLoads, itemsToLoad))
  ]).then((responses) => {
    console.log('getRouteHandler', arguments);
    return responses[1];
  });
}

function setUrl(url, replace) {
  const vurl = virtualUrl(url);
  vurl.href = url;

  if (replace) {
    window.history.replaceState(null, null, url);
  } else {
    window.history.pushState(null, null, url);
  }
}

function notfound (url) {
  console.log('notfound', url);
  return Flux.goTo('notfound', 404);
}

const Flux = Object.assign(
  EventEmitter.prototype,
  mapValues(Actions, emitify),
  {
    init(initialUrl) {
      const vurl = virtualUrl(initialUrl || window.location.href);

      window.onpopstate = () => {
        let url = window.location.href;
        if(window.location.href.indexOf('#') > -1) {
          url = window.location.hash.substr(1);
        }
        Flux.navigate(url, true, true);
      };

      if (!RoutePattern.fromString(Routes.home.pattern).matches(vurl.pathname)) {
        return Flux.navigate(vurl.original, false, false, true, true);
      } else {
        setUrl(vurl.original, true);
        return getRouteHandler(Routes.home.id, Routes.home.data(), Routes.home.statusCode || 200);
      }
    },
    navigate(urlString, history, ignoreUrl, replaceState, force) {
      const vurl = virtualUrl(urlString);
      const pathname = vurl.pathname;
      let action;
      let params;
      let route = find(Routes, (route) => {
        return RoutePattern.fromString(route.pattern).matches(pathname);
      });

      if (route) {
        params = RoutePattern.fromString(route.pattern).match(pathname).params;
        action = getRouteHandler(route.id, route.data.apply(null, params), route.statusCode || 200);
      } else {
        action = notfound;
        params = [pathname];
      }
      if (!ignoreUrl) {
        setUrl(urlString, replaceState);
      }
      if(!history) {
        window.document.body.scrollTop = 0;
      }
      console.log('matched route', route);
      console.log('itemsToLoad', route.data.apply(null, params));
      return action.then(state => {
        console.log('about to emit', state);
        Flux.emit('change', state);
        return Promise.resolve(state);
      });
    },
    addChangeListener(callback) {
      Flux.on('change', callback);
    },
    removeChangeListener(callback) {
      Flux.removeListener('change', callback);
    },
    override(url) {
      return (e) => {
        e.preventDefault();
        Flux.navigate(url);
      };
    }
  }
);

window.Flux = Flux;

export default Flux

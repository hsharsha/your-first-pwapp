/*
 * @license
 * Your First PWA Codelab (https://g.co/codelabs/pwa)
 * Copyright 2019 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License
 */
'use strict';

const weatherApp = {
  selectedLocations: {},
  addDialogContainer: document.getElementById('addDialogContainer'),
};

/**
 * Toggles the visibility of the add location dialog box.
 */
function toggleAddDialog() {
  weatherApp.addDialogContainer.classList.toggle('visible');
}

/**
 * Event handler for butDialogAdd, adds the selected location to the list.
 */
function addLocation() {
  // Hide the dialog
  toggleAddDialog();
  Object.keys(weatherApp.selectedLocations).forEach((key) => {
    const location = weatherApp.selectedLocations[key];
    // Save the updated list of selected cities.
    saveLocationList(location);
  });
}

function getLocsfromLocalStorage() {
  let locs = localStorage.getItem('locationList');
  if (locs) {
    try {
      locs = JSON.parse(locs);
    } catch (ex) {
      locs = {};
    }
  } else {
      locs = {};
  }
  return locs;
}

function showFavLocsfromLocatStorage(locs) {
  const data = JSON.stringify(locs);
  localStorage.setItem('locationList', data);

  // Get dropdown element from DOM
  const dropdown = document.getElementById("selectCityToAdd");
  dropdown.length = 0;
  // Loop through the array
  for (const key in locs) {
    // Append the element to the end of Array list
    dropdown[dropdown.length] = new Option(locs[key].label, key);
  }

}
/**
 * Event handler for .remove-city, removes a location from the list.
 *
 * @param {Event} evt
 */
function removeLocation(evt) {
  const e = document.getElementById("selectCityToAdd");
  const delkey = e.options[e.selectedIndex].value;
  const locs = getLocsfromLocalStorage();
  if (locs[delkey]) {
    delete locs[delkey]
  }
  showFavLocsfromLocatStorage(locs);
}

function showLocation(evt) {
  const e = document.getElementById("selectCityToAdd");
  const key = e.options[e.selectedIndex].value;
  const locs = getLocsfromLocalStorage();
  toggleAddDialog()
  showPositionOnMap(locs[key].coords);
}

function createPopupParentDiv(card) {
  const parentDiv = document.createElement('div');
  const popupcardContainer = document.createElement('div');
  popupcardContainer.className = 'weather-card';
  popupcardContainer.innerHTML = card.innerHTML;
  parentDiv.appendChild(popupcardContainer);
  // This is hack to remove the card from the html div element
  card.classList.remove('weather-card');

  return parentDiv;
}

/**
 * Renders the forecast data into the card element.
 *
 * @param {Element} card The card element to update.
 * @param {Object} data Weather forecast data to update the element with.
 */
function renderForecast(card, data) {
  if (!data) {
    // There's no data, skip the update.
    return;
  }

  // Find out when the element was last updated.
  const cardLastUpdatedElem = card.querySelector('.card-last-updated');
  const cardLastUpdated = cardLastUpdatedElem.textContent;
  const lastUpdated = parseInt(cardLastUpdated);

  // If the data on the element is newer, skip the update.
  // TODO Duplicated code make it into a function
  if (lastUpdated >= data.currently.time) {
    return createPopupParentDiv(card);
  }
  cardLastUpdatedElem.textContent = data.currently.time;

  // Render the forecast data into the card.
  card.querySelector('.location').textContent = data.timezone;
  card.querySelector('.description').textContent = data.currently.summary;
  const forecastFrom = luxon.DateTime
      .fromSeconds(data.currently.time)
      .setZone(data.timezone)
      .toFormat('DDDD t');
  card.querySelector('.date').textContent = forecastFrom;
  card.querySelector('.current .icon')
      .className = `icon ${data.currently.icon}`;
  const cel = (data.currently.temperature - 32) * (5.0/9.0);
  card.querySelector('.current .temperature .value')
      .textContent = Math.round(data.currently.temperature);
  card.querySelector('.current .temperatureCel .value')
      .textContent = Math.round(cel);
  card.querySelector('.current .humidity .value')
      .textContent = Math.round(data.currently.humidity * 100);
  card.querySelector('.current .wind .value')
      .textContent = Math.round(data.currently.windSpeed);
  card.querySelector('.current .wind .direction')
      .textContent = Math.round(data.currently.windBearing);
  const sunrise = luxon.DateTime
      .fromSeconds(data.daily.data[0].sunriseTime)
      .setZone(data.timezone)
      .toFormat('t');
  card.querySelector('.current .sunrise .value').textContent = sunrise;
  const sunset = luxon.DateTime
      .fromSeconds(data.daily.data[0].sunsetTime)
      .setZone(data.timezone)
      .toFormat('t');
  card.querySelector('.current .sunset .value').textContent = sunset;

  // Render the next 7 days.
  const futureTiles = card.querySelectorAll('.future .oneday');
  futureTiles.forEach((tile, index) => {
    const forecast = data.daily.data[index + 1];
    const forecastFor = luxon.DateTime
        .fromSeconds(forecast.time)
        .setZone(data.timezone)
        .toFormat('ccc');
    tile.querySelector('.date').textContent = forecastFor;
    tile.querySelector('.icon').className = `icon ${forecast.icon}`;
    tile.querySelector('.temp-high .value')
        .textContent = Math.round(forecast.temperatureHigh);
    tile.querySelector('.temp-low .value')
        .textContent = Math.round(forecast.temperatureLow);
  });

  // If the loading spinner is still visible, remove it.
  const spinner = card.querySelector('.card-spinner');
  if (spinner) {
    card.removeChild(spinner);
  }

  // HACK do this right way
  // Create a parent div to push the weather card into mapbox poppup
  return createPopupParentDiv(card);
}

/**
 * Get's the latest forecast data from the network.
 *
 * @param {string} coords Location object to.
 * @return {Object} The weather forecast, if the request fails, return null.
 */
function getForecastFromNetwork(coords) {
  return fetch(`/forecast/${coords}`)
      .then((response) => {
        return response.json();
      })
      .catch(() => {
        return null;
      });
}

/**
 * Get's the cached forecast data from the caches object.
 *
 * @param {string} coords Location object to.
 * @return {Object} The weather forecast, if the request fails, return null.
 */
function getForecastFromCache(coords) {
  if (!('caches' in window)) {
    return null;
  }
  const url = `${window.location.origin}/forecast/${coords}`;
  return caches.match(url)
    .then((response) => {
      if (response) {
        return response.json();
      }
      return null;
    })
    .catch((err) => {
      console.error('Error getting data from cache', err);
      return null;
    });
}

/**
 * Get's the HTML element for the weather forecast, or clones the template
 * and adds it to the DOM if we're adding a new item.
 *
 * @param {Object} location Location object
 * @return {Element} The element for the weather forecast.
 */
function getForecastCard(location) {
  const id = location.geo;
  const card = document.getElementById(id);
  if (card) {
    return card;
  }
  const newCard = document.getElementById('weather-template').cloneNode(true);
  newCard.querySelector('.location').textContent = location.label;
  newCard.setAttribute('id', id);
  document.querySelector('main').appendChild(newCard);
  //newCard.removeAttribute('hidden');
  return newCard;
}

var mapPopup = null;
/**
 * Gets the latest weather forecast data and updates each card with the
 * new data.
 */
function updateData(mapLoc) {
  Object.keys(weatherApp.selectedLocations).forEach((key) => {
    const location = weatherApp.selectedLocations[key];
    const card = getForecastCard(location);
    getForecastFromCache(location.geo)
      .then((forecast) => {
          if (forecast === null) {
            console.log('From cache Null forecast bailing out')
            return;
          }
          location.label = forecast.timezone
          const renderDiv = renderForecast(card, forecast);
          if (mapPopup !== null) mapPopup.remove();
          mapPopup = new mapboxgl.Popup()
            .setLngLat(mapLoc)
            .setHTML(renderDiv.innerHTML)
            .addTo(map);
      });
    // Get the forecast data from the network.
    getForecastFromNetwork(location.geo)
        .then((forecast) => {
          if (forecast === null) {
            console.log('From network Null forecast bailing out')
            return;
          }
          // Update location label with forecast timezone
          location.label = forecast.timezone
          const renderDiv = renderForecast(card, forecast);
          if (mapPopup !== null) mapPopup.remove();
          mapPopup = new mapboxgl.Popup()
            .setLngLat(mapLoc)
            .setHTML(renderDiv.innerHTML)
            .addTo(map);
        });
  });
}

/**
 * Saves the list of locations.
 *
 * @param {Object} locations The list of locations to save.
 */
function saveLocationList(locations) {
  const locs = getLocsfromLocalStorage();
  locs[locations.geo] = locations
  showFavLocsfromLocatStorage(locs);
}

/**
 * Loads the list of saved location.
 *
 * @return {Array}
 */
function loadLocationList(location) {
  let locations = localStorage.getItem('locationList');
  if (locations) {
    try {
      locations = JSON.parse(locations);
    } catch (ex) {
      locations = {};
    }
  }
  if (!locations || Object.keys(locations).length === 0) {
    const key = location.geo;
    locations = {};
    // Update label to timezone information from forecast later
    locations[key] = {label: 'dummyTimezone', geo: location.geo};
  }
  return locations;
}

function showPositionOnMap(position) {
  map.flyTo({center:[position.longitude, position.latitude]})
  if (mapMarker !== null) mapMarker.remove()
  mapMarker = new mapboxgl.Marker()
    .setLngLat([position.longitude, position.latitude])
    .addTo(map);
  const location = {label:'dummyTimezone', geo: position.latitude + ',' + position.longitude, coords: {longitude: position.longitude, latitude: position.latitude}}
  let locations = {}
  locations[location.geo] = {label: location.label, geo: location.geo, coords: location.coords};
  weatherApp.selectedLocations = locations;
  updateData([position.longitude, position.latitude]);
 }


function success(pos) {
  const crd = pos.coords;
  showPositionOnMap(crd);
  return crd;
}

function error(err) {
  console.warn(`ERROR(${err.code}): ${err.message}`);
}

function updateCurGeoData() {
  const options = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
  };

  // Use geo location api to get current geo location
  navigator.geolocation.getCurrentPosition(success, error, options);
}

/* TODO get rid of these global variables */
var map = null;
var mapMarker = null
/**
 * Initialize the app, gets the list of locations from local storage, then
 * renders the initial data.
 */
function init() {
  mapboxgl.accessToken = 'pk.eyJ1IjoiaGFyc2hhaHMiLCJhIjoiY2swZGNrZW1uMDZnczNmcWRkeXBiYTFjZCJ9.s4NlcWE9u6cEshAgtK4HTg';
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11?optimized=true',
     zoom: 1,
  });
  map.on('click', function (e) {
    showPositionOnMap({longitude:e.lngLat.lng, latitude:e.lngLat.lat});
  });

  updateCurGeoData()
    // Get the location list, and update the UI.
  //weatherApp.selectedLocations = loadLocationList();

  // Set up the event handlers for all of the buttons.
  document.getElementById('butRefresh').addEventListener('click', updateCurGeoData);
  document.getElementById('butAdd').addEventListener('click', toggleAddDialog);
  document.getElementById('butDialogCancel')
      .addEventListener('click', toggleAddDialog);
  document.getElementById('butDialogRemove')
      .addEventListener('click', removeLocation);
  document.getElementById('butDialogShow')
      .addEventListener('click', showLocation);
  document.getElementById('butDialogAddFav')
      .addEventListener('click', addLocation);
}

init();

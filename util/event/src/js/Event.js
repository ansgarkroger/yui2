/* Copyright (c) 2006 Yahoo! Inc. All rights reserved. */

// Only load this library once.  If it is loaded a second time, existing
// events cannot be detached.
if (!YAHOO.util.Event) {

/**
 * @class
 * The event utility provides functions to add and remove event listeners,
 * event cleansing.  It also tries to automatically remove listeners it
 * registers during the unload event.
 * @constructor
 */
    YAHOO.util.Event = function() {

        /**
         * True after the onload event has fired
         * @type boolean
         * @private
         */
        var loadComplete =  false;

        /**
         * Cache of wrapped listeners
         * @type array
         * @private
         */
        var listeners = [];

        /**
         * Listeners that will be attached during the onload event
         * @type array
         * @private
         */
        var delayedListeners = [];

        /**
         * User-defined unload function that will be fired before all events
         * are detached
         * @type array
         * @private
         */
        var unloadListeners = [];

        /**
         * Cache of the custom events that have been defined.  Used for
         * automatic cleanup
         * @type array
         * @private
         */
        var customEvents = [];

        /**
         * Cache of DOM0 event handlers to work around issues with DOM2 events
         * in Safari
         * @private
         */
        var legacyEvents = [];

        /**
         * Listener stack for DOM0 events
         * @private
         */
        var legacyHandlers = [];

        /**
         * The number of times to poll after window.onload.  This number is
         * increased if additional late-bound handlers are requested after
         * the page load.
         * @private
         */
        var retryCount = 0;

        /**
         * onAvailable listeners
         * @private
         */
        var onAvailStack = [];

        return { // PREPROCESS

            /**
             * The number of times we should look for elements that are not
             * in the DOM at the time the event is requested after the document
             * has been loaded.  The default is 200@50 ms, so it will poll
             * for 10 seconds or until all outstanding handlers are bound
             * (whichever comes first).
             * @type int
             */
            POLL_RETRYS: 200,

            /**
             * The poll interval in milliseconds
             * @type int
             */
            POLL_INTERVAL: 50,

            /**
             * Element to bind, int constant
             * @type int
             */
            EL: 0,

            /**
             * Type of event, int constant
             * @type int
             */
            TYPE: 1,

            /**
             * Function to execute, int constant
             * @type int
             */
            FN: 2,

            /**
             * Function wrapped for scope correction and cleanup, int constant
             * @type int
             */
            WFN: 3,

            /**
             * Object passed in by the user that will be returned as a 
             * parameter to the callback, int constant
             * @type int
             */
            SCOPE: 3,

            /**
             * Adjusted scope, either the element we are registering the event
             * on or the custom object passed in by the listener, int constant
             * @type int
             */
            ADJ_SCOPE: 4,

            /**
             * Safari detection is necessary to work around the preventDefault
             * bug that makes it so you can't cancel a href click from the 
             * handler.  There is not a capabilities check we can use here.
             * @private
             */
            isSafari: (/Safari|Konqueror|KHTML/gi).test(navigator.userAgent),

            /**
             * IE detection needed to properly calculate pageX and pageY.  
             * capabilities checking didn't seem to work because another 
             * browser that does not provide the properties have the values 
             * calculated in a different manner than IE.
             * @private
             */
            isIE: (!this.isSafari && !navigator.userAgent.match(/opera/gi) && 
                    navigator.userAgent.match(/msie/gi)),

            /**
             * @private
             */
            addDelayedListener: function(el, sType, fn, oScope, bOverride) {
                delayedListeners[delayedListeners.length] =
                    [el, sType, fn, oScope, bOverride];

                // If this happens after the inital page load, we need to
                // reset the poll counter so that we continue to search for
                // the element for a fixed period of time.
                if (loadComplete) {
                    retryCount = this.POLL_RETRYS;
                    this.startTimeout(0);
                    // this._tryPreloadAttach();
                }
            },

            /**
             * @private
             */
            startTimeout: function(interval) {
                var i = (interval || interval === 0) ? interval : this.POLL_INTERVAL;
                this.timeout = setTimeout("YAHOO.util.Event._tryPreloadAttach()", i);
            },

            /**
             * Executes the supplied callback when the item with the supplied
             * id is found.  This is meant to be used to execute behavior as
             * soon as possible as the page loads.  If you use this after the
             * initial page load it will poll for a fixed time for the element.
             * The number of times it will poll and the frequency are
             * configurable.  By default it will poll for 10 seconds.
             * @param {string} p_id the id of the element to look for.
             * @param {function} p_fn what to execute when the element is found.
             * @param {object} p_obj an optional object to be passed back as
             * a parameter to p_fn.
             * @param {boolean} p_override If set to true, p_fn will execute
             * in the scope of p_obj
             *
             */
            onAvailable: function(p_id, p_fn, p_obj, p_override) {
                onAvailStack.push( { id:       p_id, 
                                     fn:       p_fn, 
                                     obj:      p_obj, 
                                     override: p_override } );

                retryCount = this.POLL_RETRYS;
                this.startTimeout(0);
                // this._tryPreloadAttach();
            },

            /**
             * Appends an event handler
             *
             * @param {Object}   el        The html element to assign the 
             *                             event to
             * @param {String}   sType     The type of event to append
             * @param {Function} fn        The method the event invokes
             * @param {Object}   oScope    An arbitrary object that will be 
             *                             passed as a parameter to the handler
             * @param {boolean}  bOverride If true, the obj passed in becomes
             *                             the execution scope of the listener
             * @return {boolean} True if the action was successful or defered,
             *                        false if one or more of the elements 
             *                        could not have the event bound to it.
             */
            addListener: function(el, sType, fn, oScope, bOverride) {

                // The el argument can be an array of elements or element ids.
                if ( this._isValidCollection(el)) {
                    var ok = true;
                    for (var i=0; i< el.length; ++i) {
                        ok = ( this.on(el[i], 
                                       sType, 
                                       fn, 
                                       oScope, 
                                       bOverride) && ok );
                    }
                    return ok;

                } else if (typeof el == "string") {
                    var oEl = this.getEl(el);
                    // If the el argument is a string, we assume it is 
                    // actually the id of the element.  If the page is loaded
                    // we convert el to the actual element, otherwise we 
                    // defer attaching the event until onload event fires

                    // check to see if we need to delay hooking up the event 
                    // until after the page loads.
                    if (loadComplete && oEl) {
                        el = oEl;
                    } else {
                        // defer adding the event until onload fires
                        this.addDelayedListener(el, 
                                                sType, 
                                                fn, 
                                                oScope, 
                                                bOverride);

                        return true;
                    }
                }

                // Element should be an html element or an array if we get 
                // here.
                if (!el) {
                    // this.logger.debug("unable to attach event " + sType);
                    return false;
                }

                // we need to make sure we fire registered unload events 
                // prior to automatically unhooking them.  So we hang on to 
                // these instead of attaching them to the window and fire the
                // handles explicitly during our one unload event.
                if ("unload" == sType && oScope !== this) {
                    unloadListeners[unloadListeners.length] =
                            [el, sType, fn, oScope, bOverride];
                    return true;
                }

                // this.logger.debug("Adding handler: " + el + ", " + sType);

                // if the user chooses to override the scope, we use the custom
                // object passed in, otherwise the executing scope will be the
                // HTML element that the event is registered on
                var scope = (bOverride) ? oScope : el;

                // wrap the function so we can return the oScope object when
                // the event fires;
                var wrappedFn = function(e) {
                        return fn.call(scope, YAHOO.util.Event.getEvent(e), 
                                oScope);
                    };

                var li = [el, sType, fn, wrappedFn, scope];
                var index = listeners.length;
                // cache the listener so we can try to automatically unload
                listeners[index] = li;

                if (this.useLegacyEvent(el, sType)) {
                    var legacyIndex = this.getLegacyIndex(el, sType);
                    if (legacyIndex == -1) {

                        legacyIndex = legacyEvents.length;
                        // cache the signature for the DOM0 event, and 
                        // include the existing handler for the event, if any
                        legacyEvents[legacyIndex] = 
                            [el, sType, el["on" + sType]];
                        legacyHandlers[legacyIndex] = [];

                        el["on" + sType] = 
                            function(e) {
                                YAHOO.util.Event.fireLegacyEvent(
                                    YAHOO.util.Event.getEvent(e), legacyIndex);
                            };
                    }

                    // add a reference to the wrapped listener to our custom
                    // stack of events
                    legacyHandlers[legacyIndex].push(index);

                // DOM2 Event model
                } else if (el.addEventListener) {
                    // this.logger.debug("adding DOM event: " + el.id + 
                    // ", " + sType);
                    el.addEventListener(sType, wrappedFn, false);
                // Internet Explorer abstraction
                } else if (el.attachEvent) {
                    el.attachEvent("on" + sType, wrappedFn);
                }

                return true;
                
            },

            /**
             * Shorthand for YAHOO.util.Event.addListener
             * @type function
             */
            // on: this.addListener,

            /**
             * When using legacy events, the handler is routed to this object
             * so we can fire our custom listener stack.
             * @private
             */
            fireLegacyEvent: function(e, legacyIndex) {
                // this.logger.debug("fireLegacyEvent " + legacyIndex);
                var ok = true;

                // var el = legacyEvents[YAHOO.util.Event.EL];

                /* this is not working because the property may get populated
                // fire the event we replaced, if it exists
                var origHandler = legacyEvents[2];
                this.logger.debug(origHandler);
                if (origHandler && origHandler.call) {
                    var ret = origHandler.call(el, e);
                    ok = (ret);
                }
                */

                var le = legacyHandlers[legacyIndex];
                for (i=0; i < le.length; ++i) {
                    var index = le[i];
                    // this.logger.debug(index);
                    if (index) {
                        var li = listeners[index];
                        if ( li && li[this.WFN] ) {
                            var scope = li[this.ADJ_SCOPE];
                            var ret = li[this.WFN].call(scope, e);
                            ok = (ok && ret);
                        } else {
                            // This listener was removed, so delete it from
                            // the array
                            delete le[i];
                        }
                        // this.logger.debug(ok);
                    }
                }

                return ok;
            },

            /**
             * Returns the legacy event index that matches the supplied 
             * signature
             * @private
             */
            getLegacyIndex: function(el, sType) {
                for (var i=0; i < legacyEvents.length; ++i) {
                    var le = legacyEvents[i];
                    if (le && le[0] == el && le[1] == sType) {
                        return i;
                    }
                }

                return -1;
            },

            /**
             * Logic that determines when we should automatically use legacy
             * events instead of DOM2 events.
             * @private
             */
            useLegacyEvent: function(el, sType) {

                return ( (!el.addEventListener && !el.attachEvent) || 
                                (sType == "click" && this.isSafari) );
            },
                    
            /**
             * Removes an event handler
             *
             * @param {Object} el the html element or the id of the element to 
             * assign the event to.
             * @param {String} sType the type of event to remove
             * @param {Function} fn the method the event invokes
             * @return {boolean} true if the unbind was successful, false 
             * otherwise
             */
            removeListener: function(el, sType, fn) {

                // The el argument can be a string
                if (typeof el == "string") {
                    el = this.getEl(el);
                // The el argument can be an array of elements or element ids.
                } else if ( this._isValidCollection(el)) {
                    var ok = true;
                    for (var i=0; i< el.length; ++i) {
                        ok = ( this.removeListener(el[i], sType, fn) && ok );
                    }
                    return ok;
                }

                var cacheItem = null;
                var index = this._getCacheIndex(el, sType, fn);

                if (index >= 0) {
                    cacheItem = listeners[index];
                }

                if (!el || !cacheItem) {
                    // this.logger.debug("cached listener not found");
                    return false;
                }

                // this.logger.debug("Removing handler: " + el + ", " + sType);

                if (el.removeEventListener) {
                    el.removeEventListener(sType, cacheItem[this.WFN], false);
                    // this.logger.debug("adsf");
                } else if (el.detachEvent) {
                    el.detachEvent("on" + sType, cacheItem[this.WFN]);
                }

                // removed the wrapped handler
                delete listeners[index][this.WFN];
                delete listeners[index][this.FN];
                delete listeners[index];

                return true;

            },

            /**
             * Returns the event's target element
             * @param {Event} ev the event
             * @param {boolean} resolveTextNode when set to true the target's
             *                  parent will be returned if the target is a 
             *                  text node
             * @return {HTMLElement} the event's target
             */
            getTarget: function(ev, resolveTextNode) {
                var t = ev.target || ev.srcElement;

                if (resolveTextNode && t && "#text" == t.nodeName) {
                    // this.logger.debug("target is text node, returning 
                    // parent");
                    return t.parentNode;
                } else {
                    return t;
                }
            },

            /**
             * Returns the event's pageX
             * @param {Event} ev the event
             * @return {int} the event's pageX
             */
            getPageX: function(ev) {
                var x = ev.pageX;
                if (!x && 0 !== x) {
                    x = ev.clientX || 0;

                    if ( this.isIE ) {
                        x += this._getScrollLeft();
                    }
                }

                return x;
            },

            /**
             * Returns the event's pageY
             * @param {Event} ev the event
             * @return {int} the event's pageY
             */
            getPageY: function(ev) {
                var y = ev.pageY;
                if (!y && 0 !== y) {
                    y = ev.clientY || 0;

                    if ( this.isIE ) {
                        y += this._getScrollTop();
                    }
                }


                return y;
            },

            /**
             * Returns the pageX and pageY properties as an indexed array.
             * @type int[]
             */
            getXY: function(ev) {
                return [this.getPageX(ev), this.getPageY(ev)];
            },

            /**
             * Returns the event's related target 
             * @param {Event} ev the event
             * @return {HTMLElement} the event's relatedTarget
             */
            getRelatedTarget: function(ev) {
                var t = ev.relatedTarget;
                if (!t) {
                    if (ev.type == "mouseout") {
                        t = ev.toElement;
                    } else if (ev.type == "mouseover") {
                        t = ev.fromElement;
                    }
                }

                return t;
            },

            /**
             * Returns the time of the event.  If the time is not included, the
             * event is modified using the current time.
             * @param {Event} ev the event
             * @return {Date} the time of the event
             */
            getTime: function(ev) {
                if (!ev.time) {
                    var t = new Date().getTime();
                    try {
                        ev.time = t;
                    } catch(e) { 
                        // can't set the time property  
                        return t;
                    }
                }

                return ev.time;
            },

            /**
             * Convenience method for stopPropagation + preventDefault
             * @param {Event} ev the event
             */
            stopEvent: function(ev) {
                this.stopPropagation(ev);
                this.preventDefault(ev);
            },

            /**
             * Stops event propagation
             * @param {Event} ev the event
             */
            stopPropagation: function(ev) {
                if (ev.stopPropagation) {
                    ev.stopPropagation();
                } else {
                    ev.cancelBubble = true;
                }
            },

            /**
             * Prevents the default behavior of the event
             * @param {Event} ev the event
             */
            preventDefault: function(ev) {
                if (ev.preventDefault) {
                    ev.preventDefault();
                } else {
                    ev.returnValue = false;
                }
            },
             
            /**
             * Finds the event in the window object, the caller's arguments, or
             * in the arguments of another method in the callstack.  This is
             * executed automatically for events registered through the event
             * manager, so the implementer should not normally need to execute
             * this function at all.
             * @param {Event} the event parameter from the handler
             * @return {Event} the event 
             */
            getEvent: function(e) {
                var ev = e || window.event;

                if (!ev) {
                    var c = this.getEvent.caller;
                    while (c) {
                        ev = c.arguments[0];
                        if (ev && Event == ev.constructor) {
                            break;
                        }
                        c = c.caller;
                    }
                }

                return ev;
            },

            /**
             * Returns the charcode for an event
             * @param {Event} ev the event
             * @return {int} the event's charCode
             */
            getCharCode: function(ev) {
                return ev.charCode || (ev.type == "keypress") ? ev.keyCode : 0;
            },

            /**
             * @private
             * Locating the saved event handler data by function ref
             */
            _getCacheIndex: function(el, sType, fn) {
                for (var i=0; i< listeners.length; ++i) {
                    var li = listeners[i];
                    if ( li                 && 
                         li[this.FN] == fn  && 
                         li[this.EL] == el  && 
                         li[this.TYPE] == sType ) {
                        return i;
                    }
                }

                return -1;
            },

            /**
             * We want to be able to use getElementsByTagName as a collection
             * to attach a group of events to.  Unfortunately, different 
             * browsers return different types of collections.  This function
             * tests to determine if the object is array-like.  It will also 
             * fail if the object is an array, but is empty.
             * @param o the object to test
             * @return {boolean} true if the object is array-like and populated
             * @private
             */
            _isValidCollection: function(o) {
                // this.logger.debug(o.constructor.toString())
                // this.logger.debug(typeof o)

                return ( o                    && // o is something
                         o.length             && // o is indexed
                         typeof o != "string" && // o is not a string
                         !o.tagName           && // o is not an HTML element
                         !o.alert             && // o is not a window
                         typeof o[0] != "undefined" );

            },

            /**
             * @private
             * DOM element cache
             */
            elCache: {},

            /**
             * We cache elements bound by id because when the unload event 
             * fires, we can no longer use document.getElementById
             * @private
             */
            getEl: function(id) {
                /*
                // this is a problem when replaced via document.getElementById
                if (! this.elCache[id]) {
                    try {
                        var el = document.getElementById(id);
                        if (el) {
                            this.elCache[id] = el;
                        }
                    } catch (er) {
                        // this.logger.debug("document obj not currently 
                        // available");
                    }
                }
                return this.elCache[id];
                */

                return document.getElementById(id);
            },

            /**
             * Clears the element cache
             */
            clearCache: function() {
                for (i in this.elCache) {
                    delete this.elCache[i];
                }
            },

            /**
             * Called by CustomEvent instances to provide a handle to the 
             * event * that can be removed later on.  Should be package 
             * protected.
             * @private
             */
            regCE: function(ce) {
                customEvents.push(ce);
            },

            /**
             * @private
             * hook up any deferred listeners
             */
            _load: function(e) {
                // me.logger = new ygLogger("pe.Event");
                //me.logger.debug([this.isSafari, this.isOpera, this.isIE]);
                loadComplete = true;
            },

            /**
             * Polling function that runs before the onload event fires, 
             * attempting * to attach to DOM Nodes as soon as they are 
             * available
             * @private
             */
            _tryPreloadAttach: function() {

                if (this.locked) {
                    return false;
                }

                this.locked = true;

                // this.logger.debug("tryPreloadAttach");

                // keep trying until after the page is loaded.  We need to 
                // check the page load state prior to trying to bind the 
                // elements so that we can be certain all elements have been 
                // tested appropriately
                var tryAgain = !loadComplete;
                if (!tryAgain) {
                    tryAgain = (retryCount > 0);
                }

                // Delayed listeners
                var stillDelayed = [];

                for (var i=0; i < delayedListeners.length; ++i) {
                    var d = delayedListeners[i];
                    // There may be a race condition here, so we need to 
                    // verify the array element is usable.
                    if (d) {

                        // el will be null if document.getElementById did not
                        // work
                        var el = this.getEl(d[this.EL]);

                        if (el) {
                            // this.logger.debug("attaching: " + d[this.EL]);
                            this.on(el, d[this.TYPE], d[this.FN], 
                                    d[this.SCOPE], d[this.ADJ_SCOPE]);
                            delete delayedListeners[i];
                        } else {
                            stillDelayed.push(d);
                        }
                    }
                }

                delayedListeners = stillDelayed;

                // onAvailable
                notAvail = [];
                for (i=0; i < onAvailStack.length; ++i) {
                    var item = onAvailStack[i];
                    if (item) {
                        el = this.getEl(item.id);

                        if (el) {
                            var scope = (item.override) ? item.obj : el;
                            item.fn.call(scope, item.obj);
                            delete onAvailStack[i];
                        } else {
                            notAvail.push(item);
                        }
                    }
                }

                retryCount = (stillDelayed.length === 0 && 
                                    notAvail.length === 0) ? 0 : retryCount - 1;

                if (tryAgain) {
                    this.startTimeout();
                }

                this.locked = false;

            },

            /**
             * Removes all listeners registered by pe.event.  Called 
             * automatically during the unload event.
             * @private
             */
            _unload: function(e, me) {
                for (var i=0; i < unloadListeners.length; ++i) {
                    var l = unloadListeners[i];
                    if (l) {
                        var scope = (l[this.ADJ_SCOPE]) ? l[this.SCOPE]: window;
                        l[this.FN].call(scope, this.getEvent(e), l[this.SCOPE] );
                    }
                }

                if (listeners && listeners.length > 0) {
                    for (i = 0; i < listeners.length; ++i) {
                        l = listeners[i];
                        if (l) {
                            this.removeListener(l[this.EL], l[this.TYPE], 
                                    l[this.FN]);
                        }
                    }

                    this.clearCache();
                }

                for (i = 0; i < customEvents.length; ++i) {
                    customEvents[i].unsubscribeAll();
                    delete customEvents[i];
                }

                for (i = 0; i < legacyEvents.length; ++i) {
                    // dereference the element
                    delete legacyEvents[i][0];
                    // delete the array item
                    delete legacyEvents[i];
                }
            },

            /**
             * Returns scrollLeft
             * @private
             */
            _getScrollLeft: function() {
                return this._getScroll()[1];
            },

            /**
             * Returns scrollTop
             * @private
             */
            _getScrollTop: function() {
                return this._getScroll()[0];
            },

            /**
             * Returns the scrollTop and scrollLeft.  Used to calculate the 
             * pageX and pageY in Internet Explorer
             * @private
             */
            _getScroll: function() {
                var dd = document.documentElement; db = document.body;
                if (dd && dd.scrollTop) {
                    return [dd.scrollTop, dd.scrollLeft];
                } else if (db) {
                    return [db.scrollTop, db.scrollLeft];
                } else {
                    return [0, 0];
                }
            }
        };
    } ();

    /**
     * @private
     */
    YAHOO.util.Event.on = YAHOO.util.Event.addListener;

    if (document && document.body) {
        YAHOO.util.Event._load();
    } else {
        YAHOO.util.Event.on(window, "load", YAHOO.util.Event._load, 
                YAHOO.util.Event, true);
    }

    YAHOO.util.Event.on(window, "unload", YAHOO.util.Event._unload, 
                YAHOO.util.Event, true);

    YAHOO.util.Event._tryPreloadAttach();

}


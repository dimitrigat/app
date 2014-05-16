'use strict';
/* global sofa */
/* global FastClick */
/* global document */


// We have to patch up the old URLs which were without hashbangs to use a hashbang instead.
// We do that before Angular starts and it has probably no business directly in sofa hence we put it here.

(function () {
    var url = window.location.toString();
    if (url.indexOf('#') > - 1) {
        window.location = url.replace('#', '#!');
    }
})();

//we need this to be available in the Angular config phase
//since Angular does not allow access to services in the config
//phase, we need to access it as non angular service for now
cc.deviceService = new cc.DeviceService(window);
//shortHand
cc.isTabletSize = cc.deviceService.isTabletSize();

// this is an empty dummy package. It can be overwritten by simply
// pasting customer specific code through the admin UI
angular.module('CouchCommerceApp.plugins', []);

// Declare app level module which depends on filters, and services
angular.module('CouchCommerceApp', [
    'ngSanitize',
    'ui.state',
    'sdk.decorators.$rootScope',
    'sdk.services.couchService',
    'sdk.services.navigationService',
    'sdk.services.basketService',
    'sdk.services.wishlistService',
    'sdk.services.couponService',
    'sdk.services.pagesService',
    'sdk.services.deviceService',
    'sdk.services.checkoutService',
    'sdk.services.userService',
    'sdk.services.configService',
    'sdk.services.searchService',
    'sdk.services.injectsService',
    'sdk.services.trackingService',
    'sdk.services.requestAnimationFrame',
    'sdk.directives',
    'sdk.filter',
    'ui.bootstrap',
    'pasvaz.bindonce',
    'templates',
    'snap',
    'chayns',
    'CouchCommerceApp.plugins'
])
.config(function ($stateProvider, $locationProvider, $urlRouterProvider, screenIndexes, snapRemoteProvider) {

    $locationProvider.html5Mode(true).hashPrefix('!');

    // let's keep this in for easier debugging of hashbang URL issues
    // $provide.decorator('$sniffer', function ($delegate) {
    //     $delegate.history = false;
    //     return $delegate;
    // });

    snapRemoteProvider.globalOptions.addBodyClasses = true;
    snapRemoteProvider.globalOptions.hyperextensible = false;

    var categoryStateConfig = {
        url: '/',
        templateUrl: cc.isTabletSize ? 'categories/cc-category-grid.tpl.html' : 'categories/cc-category-list.tpl.html',
        controller: 'CategoryController',
        screenIndex: screenIndexes.category,
        resolve: {
            category: ['couchService', '$stateParams', 'navigationService', '$q', function (couchService, $stateParams, navigationService, $q) {

                return couchService
                        .getCategory($stateParams.category)
                        .then(function (category) {
                            //we need to make that check here *before* the CategoryController
                            //is intialized. Otherwise we will have double transitions in such
                            //cases.
                            if (category && !category.children) {
                                navigationService.navigateToProducts(category.urlId);
                                return $q.reject();
                            }
                            return category;
                        });
            }]
        }
    };

    $stateProvider
        .state('categoryempty', categoryStateConfig)
        .state('category', angular.extend({}, categoryStateConfig, { url: '/cat/:category' }))

        .state('products', {
            url: '/cat/:category/products',
            templateUrl: 'products/cc-product-grid.tpl.html',
            controller: 'ProductsController',
            resolve: {
                products: ['couchService', '$stateParams', function (couchService, $stateParams) {
                    return couchService.getProducts($stateParams.category);
                }],
                category: ['couchService', '$stateParams', function (couchService, $stateParams) {
                    return couchService.getCategory($stateParams.category);
                }]
            },
            screenIndex: screenIndexes.products
        })

        .state('product', {
            url: '/cat/:category/product/:productUrlKey',
            templateUrl: cc.isTabletSize ? 'product/cc-product-wide.tpl.html' : 'product/cc-product.tpl.html',
            controller: 'ProductController',
            resolve: {
                product: ['couchService', '$stateParams', function (couchService, $stateParams) {
                    return couchService.getProduct($stateParams.category, $stateParams.productUrlKey);
                }],
                category: ['couchService', '$stateParams', function (couchService, $stateParams) {
                    return couchService.getCategory($stateParams.category);
                }]
            },
            screenIndex: screenIndexes.product
        })

        // would really love to keep this so that we can trigger the cart opening via
        // URL. Unfortunately I haven't found a way to keep the /cart URL just as a way
        // to open the right side menu without changing the currently active state.
        // This example does not seem to apply to our case: https://github.com/angular-ui/ui-router/wiki/Frequently-Asked-Questions#wiki-how-to-open-a-dialogmodal-at-a-certain-state
        // .state('.cart', {
        //     url: '/cart',
        //     onEnter: ['$snapRemote', function ($snapRemote) {
        //         $snapRemote.open('right');
        //     }]
        // });

        .state('checkout', {
            url: '/checkout',
            templateUrl: 'checkout/cc-checkout.tpl.html',
            controller: 'CheckoutController',
            screenIndex: screenIndexes.checkout
        })

        .state('summary', {
            url: '/summary/:token',
            templateUrl: 'summary/cc-summary.tpl.html',
            controller: 'SummaryController',
            screenIndex: screenIndexes.summary
        });

    var thankyouStateConfig = {
        templateUrl: 'thankyou/cc-thankyou.tpl.html',
        controller: 'ThankyouController',
        screenIndex: screenIndexes.thankyou,
        resolve: {
            summaryResponse: ['checkoutService', function (checkoutService) {
                return checkoutService.getLastSummary();
            }]
        }
    };

    $stateProvider
        .state('thankyou', thankyouStateConfig)

        .state('thankyouWithToken', angular.extend({}, thankyouStateConfig, {
            url: '/thankyou/:token',
            resolve: {
                summaryResponse: ['checkoutService', '$stateParams', function (checkoutService, $stateParams) {
                    return checkoutService.getSummary($stateParams.token);
                }]
            }
        }))

        .state('pages', {
            url: '/pages/:pageId',
            templateUrl: 'pages/cc-pages.tpl.html',
            controller: 'PagesController',
            screenIndex: screenIndexes.pages
        });

    $stateProvider
        .state('404', {
            templateUrl: 'common/404/cc-404.tpl.html'
        });

    $urlRouterProvider.otherwise(function ($injector, $location) {
        // since we're generating HTML snapshots for search engines
        // via prerender.io, we have to add this meta tag when the
        // requested url actually returns a 404 error
        // https://prerender.io/getting-started#404s
        var meta = document.createElement('meta');
        meta.setAttribute('name', 'prerender-status-code');
        meta.setAttribute('content', '404');

        document.getElementsByTagName('head')[0].appendChild(meta);
        $location.path('/');
    });
})
//just to kick off the services
.run(['stateChangeService', 'viewClassService', 'backStepHighlightService', function () { } ])
.run(['$rootScope', '$timeout', '$window', 'slideDirectionService', 'deviceService', 'templateService', function ($rootScope, $timeout, $window, slideDirectionService, deviceService, templateService) {


    //Todo: Check what can be moved over to the MainController
    //Most things can, but things like language keys, when used from within
    //an isolated scope, directly turn to the $rootScope (as isolated scopes
    //don't inherit from a parent scope). We can fix this by providing a
    //languageService similar to the configService and then use this for such
    //cases.
    $rootScope.ln = cc.Lang;
    $rootScope.cfg = cc.Config;
    $rootScope.slideDirectionService = slideDirectionService;
    $rootScope.tpl = templateService;

    $rootScope.isTabletSize = cc.isTabletSize;

    //no need to add bindings for things that are unlikely to change over a session;
    deviceService.flagOs();
    deviceService.flagOverflowSupport();
    deviceService.flagModernFlexboxSupport();
    deviceService.flagIpadOnIos7();

    if (deviceService.isIpadOnIos7()) {
        deviceService.setViewportHeightToDeviceHeight();
    }

    $window.addEventListener('orientationchange', function () {
        $rootScope.$apply();
        if (deviceService.isIpadOnIos7()) {
            deviceService.setViewportHeightToDeviceHeight();
        }
    }, false);

}])
.run(['$rootScope', 'snapRemote', function ($rootScope, snapRemote) {
    $rootScope.$on('$stateChangeStart', function () {
        snapRemote.close();
    });
}])
.run(['deviceService', 'ccImageFullScreenService', 'ccImageZoomSettings', function (deviceService, ccImageFullScreenService, ccImageZoomSettings) {

    //by default, we enable the real zoom. We just disable it for low budget devices
    ccImageZoomSettings.enabled = true;
    ccImageFullScreenService.enabled = false;

    if (deviceService.isStockAndroidBrowser() || !deviceService.hasOverflowSupport()) {
        ccImageFullScreenService.enabled = true;
        ccImageZoomSettings.enabled = false;
    }
}])
.run(function () {
    sofa.Util.domReady(function () {
        FastClick.attach(document.body);
    });
})
.run(['titleService', function (titleService) {
    titleService.setShopNameTitle();
}])
.run(['trackingService', 'configService', function (trackingService, configService) {
    trackingService.addTracker(new cc.tracking.GoogleAnalyticsTracker({
        accountNumber: configService.get('googleAnalytics'),
        domainName: configService.get('googleAnalyticsSetDomain'),
        conversionId: configService.get('googleConversionId'),
        conversionLabel: configService.get('googleConversionLabel')
    }));

    if (configService.get('bingSiteId')) {
        trackingService.addTracker(new cc.tracking.BingTracker({
            siteId: configService.get('bingSiteId'),
            domainId: configService.get('bingDomainId'),
            actionId: configService.get('bingActionId')
        }));
    }
}]);

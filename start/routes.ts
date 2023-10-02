/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| This file is dedicated for defining HTTP routes. A single file is enough
| for majority of projects, however you can define routes in different
| files and just make sure to import them inside this file. For example
|
| Define routes in following two files
| ├── start/routes/cart.ts
| ├── start/routes/customer.ts
|
| and then import them inside `start/routes.ts` as follows
|
| import './routes/cart'
| import './routes/customer''
|
*/

import Route from '@ioc:Adonis/Core/Route'

Route.get('/home', async ({ inertia }) => {
    return inertia.render('Home')
}) 
/*
 * These routes should redirect to the main hosting domain (e.g. eth.xyz/[route])
 * Name any Edge templates for these routes by replacing dashes with underscores
 * (e.g. privacy-policy --> privacy_policy.edge)
 */
Route.get('/privacy-policy', 'LandingController.checkRouteForRedirect')
Route.get('/:domainAsPath?/privacy-policy', 'LandingController.checkRouteForRedirect')


Route.get('/404', 'LandingController.404')
Route.post('/clear-profile-cache', 'LandingController.clearProfileCache')
Route.get('/:domainAsPath?', 'LandingController.index')
Route.get('/text-records/:domain', 'LandingController.textRecords')
Route.get('/nfts/:ethWallet', 'LandingController.nfts')
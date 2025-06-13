import {LocalCollection } from './local_collection.js';

const Minimongo = {
    LocalCollection: LocalCollection,
    Matcher: LocalCollection.Matcher,
    Sorter: LocalCollection.Sorter
};

window.LocalCollection = LocalCollection;
window.Minimongo = Minimongo;

export {
    LocalCollection,
    Minimongo,
}
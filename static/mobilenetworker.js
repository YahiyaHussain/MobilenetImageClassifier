self.importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
self.importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet');
self.onmessage = async function (message) {
	const { action } = message.data;
	switch (action) {
		case 'init': {
			const { uuid } = message.data;
			const net = await mobilenet.load();
			self.net = net;
			console.log('loaded mobilenet');
			self.postMessage({ uuid });
			break;
		}
		case 'predict': {
			const { imageData } = message.data;
			const { uuid } = message.data;

			let predictions = await self.net.classify(imageData, 1);
			self.postMessage({ uuid, prediction: predictions[0].className });
			predictions = await self.net.classify(imageData, 5);
			console.log(predictions);
			break;
		}
		default:
			console.error('No valid action found');
	}
};

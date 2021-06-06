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
			const { imageURL } = message.data;
			const { uuid } = message.data;
			console.log(imageURL);
			console.log('yo');
			try {
				const urlResponse = await fetch(imageURL).catch((error) => {
					self.postMessage({ uuid, prediction: 'Dragged in non-cors compliant image, try again' });
					throw new Error(error);
				});

				// only execute if above line doesn't error
				let time1 = performance.now();
				const imageBlob = await urlResponse.blob();
				const imageBitmap = await createImageBitmap(imageBlob);
				const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
				const ctx = canvas.getContext('2d');
				ctx.drawImage(imageBitmap, 0, 0);
				const imageData = ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);

				let predictions = await self.net.classify(imageData, 1);
				self.postMessage({ uuid, prediction: predictions[0].className });
				console.log(`Conversion and Prediction took: ${performance.now() - time1} ms`);

				console.log('yo');
				time1 = performance.now();
				await Promise.all(new Array(20).fill(0).map((e) => self.net.classify(imageData, 1)));
				console.log(`${20} predictions took ${time1 - performance.now()} ms`);
				predictions = await self.net.classify(imageData, 5);
				console.log(predictions);
			} catch (e) {
				console.error(e);
			}

			break;
		}
		default:
			console.error('No valid action found');
	}
};

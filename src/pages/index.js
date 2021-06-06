import React, { useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import CardMedia from '@material-ui/core/CardMedia';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';
import { v4 as uuidv4 } from 'uuid';

import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

const useStyles = makeStyles((theme) => ({
	root: {
		maxWidth: 350,
		marginTop: 30,
		marginLeft: 400,
	},
	media: {
		height: 0,
		paddingTop: '70.25%', // 16:9
	},
}));
const constructWebWorker = function (sourcePath, name) {
	const worker = new Worker(sourcePath);
	worker.addEventListener('error', (event) => {
		console.log(`[${name}] Error`, event.message, event);
	});
	return worker;
};

const workerAction = async function (worker, action, data) {
	const UUID = uuidv4();

	return new Promise((resolve) => {
		let selfDestructingEventHandler = (event) => {
			if (event.data.uuid === UUID) {
				worker.removeEventListener('message', selfDestructingEventHandler);
				resolve(event);
			}
		};
		worker.addEventListener('message', selfDestructingEventHandler);

		worker.postMessage({ action, ...data, uuid: UUID });
	});
};

// markup
const IndexPage = () => {
	const classes = useStyles();
	const [checked, setChecked] = React.useState(true);
	const [hovering, setHovering] = React.useState(false);
	const [imageURL, setImageURL] = React.useState(undefined);
	const [title, setTitle] = React.useState('Loading...');
	const [imageTitle, setImageTitle] = React.useState('');
	const cardRef = React.useRef(null);

	const [classifier, setClassifier] = React.useState();

	const [worker, setWorker] = React.useState();

	useEffect(() => {
		mobilenet.load().then((net) => {
			console.log('MobileNet Loaded on Main Thread');
			setTitle('Drag or paste an image in!');
			setClassifier(net);
		});
	}, []);
	useEffect(() => {
		const newWorker = constructWebWorker('mobilenetworker.js', 'Worker');
		newWorker.postMessage({ action: 'init' });

		workerAction(newWorker, 'init').then(() => {
			setWorker(newWorker);
		});
	}, []);

	useEffect(() => {
		if (worker !== undefined) {
			window.addEventListener(
				'paste',
				function (pasteEvent) {
					const items = pasteEvent.clipboardData.items;
					processDataTransfer(items, mainthreadpredict, webworkerpredict);
				},
				false
			);
			var dropbox = cardRef.current;

			dropbox.addEventListener('dragenter', dragenter, false);
			dropbox.addEventListener('dragleave', dragleave, false);
			dropbox.addEventListener('dragover', noopHandler, false);
			dropbox.addEventListener('drop', drop, false);

			async function mainthreadpredict(imageURL) {
				console.log('main thread call');
				let time = performance.now();
				const imageElement = document.createElement('img');
				imageElement.crossOrigin = 'Anonymous';
				imageElement.onerror = (e) => setImageTitle('Dragged in non-CORS policy compliant image, try again');
				return new Promise((resolve) => {
					imageElement.onload = () =>
						classifier

							.classify(imageElement, 1)
							.then((r) => {
								console.log(`took ${performance.now() - time} ms`);
								console.log(r);
								setImageTitle(r[0].className);
								resolve();
							})
							.catch((e) => console.error(e));
					imageElement.src = imageURL;
				});
			}
			async function webworkerpredict(imageURL) {
				console.log('worker thread call');
				let time = performance.now();
				return workerAction(worker, 'predict', { imageURL }).then((message) => {
					const { prediction } = message.data;
					console.log(`took ${performance.now() - time} ms`);
					setImageTitle(prediction);
				});
			}

			function noopHandler(evt) {
				evt.stopPropagation();
				evt.preventDefault();
			}
			function dragenter(evt) {
				noopHandler(evt);
				setHovering(true);
			}
			function dragleave(evt) {
				noopHandler(evt);
				setHovering(false);
			}
			function drop(evt) {
				noopHandler(evt);
				setHovering(false);

				let imageURL = evt.dataTransfer.getData('Text');
				setImageURL(imageURL);

				mainthreadpredict(imageURL).then(() => webworkerpredict(imageURL));
			}
		}
		class workerCommand {
			constructor(workerReceiver, action) {
				this.workerReceiver = workerReceiver;
				this.action = action;
			}
			async execute(payload) {
				return await this.workerReceiver.dispatch(this.action, payload);
			}
		}

		class workerReceiver {
			constructor(worker) {
				this.worker = worker;
			}

			async dispatch(action, payload) {
				await workerAction(this.worker, action, payload);
			}
		}

		const processDataTransfer = function (items, mainthreadpredict, webworkerpredict) {
			for (let i = 0; i < items.length; i++) {
				if (items[i].kind === 'file') {
					let time = performance.now();
					const imageFile = items[i].getAsFile();

					const imageURL = URL.createObjectURL(imageFile);

					console.log(checked);

					mainthreadpredict(imageURL).then(() => webworkerpredict(imageURL));

					setImageURL(imageURL);
				}
			}
		};
	}, [cardRef, worker]);

	function handleCheckChange() {
		setChecked(!checked);
	}

	return (
		<div style={{ alignContent: 'center' }}>
			<CircularProgress></CircularProgress>
			<Card ref={cardRef} className={classes.root}>
				<CardHeader title="MobileNet Image Classifier" subheader={title} />
				<CardMedia
					style={{ backgroundColor: hovering ? 'lightskyblue' : null, opacity: hovering ? 0.5 : 1 }}
					className={classes.media}
					image={imageURL}
				/>
				<CardContent>
					<Typography gutterBottom variant="h6" component="h2">
						{imageTitle}
					</Typography>
					<Typography variant="body2" color="textSecondary" component="p">
						Pasting or dragging an image in will pass the image into the TensorFlow.js MobileNet classifier
						and get its outputted prediction for the image and display it.
					</Typography>
				</CardContent>
			</Card>
		</div>
	);
};

export default IndexPage;

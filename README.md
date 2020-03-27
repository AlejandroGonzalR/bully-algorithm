# Implementation of Berkeley Algorithm

The bully algorithm is a method for dynamically electing a coordinator or leader from a group of distributed computer processes. This algorithm applies to system where every process can send a message to every other process in the system.

## Getting Started

Only build the image and create the Docker container for the process using the following command:

```
docker-compose up --build
```

This will creates processes available on port **10000** to **10003**. In each process it is possible to see the record of election of leadership, carrying out verifications every 5 seconds.

![editor screenshot](https://github.com/AlejandroGonzalR/bully-algorithm/blob/master/public/images/BullyScreenshot.png)

## Authors

* **Alejandro González Rodríguez** - *Initial work*

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
